#
# Licensed under the EUPL, Version 1.1 or – as soon they
# will be approved by the European Commission - subsequent
# versions of the EUPL (the "Licence");
# You may not use this work except in compliance with the
# Licence.
# You may obtain a copy of the Licence at:
#
# https://joinup.ec.europa.eu/software/page/eupl
#
# Unless required by applicable law or agreed to in
# writing, software distributed under the Licence is
# distributed on an "AS IS" basis,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
# express or implied.
# See the Licence for the specific language governing
# permissions and limitations under the Licence.
#
"""Export related utilities, output file formats and so on"""

import collections
import math
import unix_time

# TODO: currently only one data row
# TODO: do we need this type or can we just have a tuple?
# TODO: generalize the header
ExportEntry = collections.namedtuple("ExportEntry", [ "date", "ut", "lat", "lon", "alt", "data" ])

def make_table(data, start_time, end_time, orbit):
    """
    Yields rows of ExportEntries for data in data generator that is presumed to yield values.

    - start_time is inclusive, end_time is not
    - data list must only have data between start_time and end_time
    - frequency is deduced from data length TODO: play around this
    - orbit is a list of orbit points during start_time and end_time, 1 pt per second
    """
    duration = end_time - start_time
    samples_sz = len(data)
    assert samples_sz > 4
    freq = samples_sz / duration

    # Ensuring oribit is a list
    orbit = list(orbit)

    for i in range(samples_sz):
        # Computing relative time in sec
        t = i / freq
    
        # TODO currently not interpolating anything
        lat, lon, alt = orbit[int(t)]

        """

        # On integer number of seconds we can just take the value from the table
        if t == int(t):
            lat, lon = orbit[t]
        else:
            # Picking the anchor points for interpolation
            f, c = math.floor(t), math.ceil(t)

            # Check if we are near the edges of the range or not
            if f == 0:
                ff = c + 2 # Pick the point after cc
            else
                ff = f - 1

            if c == duration:
                cc = f - 2 # Similar to above
            else:
                cc = c + 1

            anchor = [ ff, f, c, cc ]

            # Estimating the cubic function coeffs
        """

        # Splitting time to days and seconds
        tm = start_time + t
        ut = tm % (60 * 60 * 24)
        date = unix_time.maketime(int(tm)).strftime("%Y%j")

        yield ExportEntry(date, int(1e3 * ut), lat, lon, alt, data[i])


def ascii_export(table, datalabel="Data", dataunits="units"):
    """
    Takes a table generator from above and constructs an ASCII representation.

    datalabel and dataunits are used for the data column
    TODO: currently only one data column supported
    TODO: orbit no
    TODO: deduce correct field sizes

    Yields successive lines.
    """
    yield "{:^10} {:^10} {:^6} {:^6} {:^6} {:^15}".format("Date", "UT", "Lat.", "Lon.", "Alt.", datalabel)
    yield "{:^10} {:^10} {:^6} {:^6} {:^6} {:^15}".format("(YYYYDDD)", "(ms)", "(deg.)", "(deg.)", "(km)", "(%s)" % dataunits)
    for row in table:
        yield "{:>10} {:>10} {:>6.02f} {:>6.02f} {:>6.02f} {:>15.06f}".format(row.date, row.ut, row.lat, row.lon, row.alt, row.data)

def csv_export(table, datalabel="Data", dataunits="units"):
    """
    Takes a table generator from above and constructs an ASCII representation.

    datalabel and dataunits are used for the data column
    TODO: currently only one data column supported
    TODO: orbit no
    TODO: deduce correct field sizes

    Yields successive lines.
    """
    yield '"{}","{}","{}","{}","{}","{}"'.format("Date (YYYYDDD)", "UT (ms)", "Longitude (deg)", "Latitude (deg)", "Altitude (km)", datalabel + "(%s)" % dataunits)
    for row in table:
        yield ",".join(str(x) for x in [row.date, row.ut, row.lon, row.lat, row.alt, row.data])


def netcdf_export(table, datalabel="Data", dataunits="units"):
   numElems = 0
   dates = []
   uts = []
   latitudes = []
   longtitudes = []
   altitudes = []
   dataValues = []
   for row in table:
      dates.append(row.date)
      uts.append(row.ut)
      latitudes.append(row.lat)
      longtitudes.append(row.lon)
      altitudes.append(row.alt)
      dataValues.append(row.data)
      numElems = numElems + 1

   from netCDF4 import Dataset
   import tempfile
   import os
   (fd, filename) = tempfile.mkstemp()
   dataset = Dataset(filename, 'w', format='NETCDF4')
   date = dataset.createDimension('Date', None)
   ut = dataset.createDimension('UT', numElems)
   latitude = dataset.createDimension('Latitude', numElems)
   longtitude = dataset.createDimension('Longtitude', numElems)
   altitude = dataset.createDimension('Altitude', numElems)
   data = dataset.createDimension('Data', numElems)

   import numpy as np
   dateVar= dataset.createVariable('Date', np.int32, ('Date'))
   utVar = dataset.createVariable('UT', np.int32, ('UT'))
   latitudeVar = dataset.createVariable('Latitude', np.float32, ('Latitude'))
   longtitudeVar = dataset.createVariable('Longtitude', np.float32, ('Longtitude'))
   altitudeVar = dataset.createVariable('Altitude', np.float32, ('Altitude'))
   complexDataType = np.dtype([("date", np.int32), ("ut", np.int32), ("latitude", np.float32), ("longtitude", np.float32), ("altitude", np.float32), ("data", np.float32)])
   complexDataType_t = dataset.createCompoundType(complexDataType, 'dtype')
   dataVar = dataset.createVariable(datalabel, complexDataType_t, ('Data'))
   
   dateVar.units = 'YYYYDDD'
   utVar.units = 'ms'
   latitudeVar.units = 'deg'
   longtitudeVar.units = 'deg'
   altitudeVar.units = 'km'
   dataVar.units = 'Date (YYYYDDD), "UT (ms), Longitude (deg), Latitude (deg), Altitude (km)'

   dateVar[:] = dates
   utVar[:] = uts
   latitudeVar[:] = latitudes
   longtitudeVar[:] = longtitudes
   altitudeVar[:] = altitudes

   temp = np.empty(numElems, complexDataType)
   temp["date"] = dates
   temp["ut"] = uts
   temp["latitude"] = latitudes
   temp["longtitude"] = longtitudes
   temp["altitude"] = altitudes
   temp["data"] = dataValues
   dataVar[:] = temp

   dataset.close()

   f = os.fdopen(fd, 'rb')
   result = f.read()
   f.close()
   os.remove(filename)

   return result

# TODO: remove after completion
if __name__ == "__main__":
    from time import time
    dt = [ x/7 for x in range(40) ]
    start = int(time()) + 0
    end = int(time()) + 10
    orbit = [ (i/3,i/3) for i in range(11) ]

    for ln in ascii_export(make_table(dt, start, end, orbit)):
        print(ln)
