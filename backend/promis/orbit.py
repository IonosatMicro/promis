#
# Copyright 2016 Space Research Institute of NASU and SSAU (Ukraine)
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

import math
import collections
import operator
import cubefit

_earth_radius = 6371 # km

def sign(x):
    """Returns 1 for non-negative arguments and -1 otherwise."""
    return 1 if x>=0 else -1

OrbitPoint = collections.namedtuple("OrbitPoint", [ "lat", "lon", "alt" ])

def cord_conv(RX, RY, RZ, **kwargs):
    """Converts coordinates in ECEF cartesian system to latitude, longitude and altitude."""
    # TODO: is rotation included?
    # TODO: resulting tuple only has lat/lon/h, add fields if necessary
    ρ = math.sqrt(RX**2 + RY**2 + RZ**2)
    φ = math.pi/2 - math.acos(RZ/ρ)
    λ = math.acos(RX/(ρ * math.sin(math.pi/2 - φ))) * sign(RY)
    # Vector from Latitude, Longitude, Altitude
    # TODO: EPGS:4979 has altitude in meters, not kilometers
    return OrbitPoint(math.degrees(φ), math.degrees(λ), ρ - _earth_radius)

# Generating an orbit point every 1 second, discarding extra point and filling the gaps
def generate_orbit(datapoints, orbit_start, orbit_end, isOrbitExtended = False):
    datakeys = datapoints.keys()
    time_start, time_end = min(datakeys), max(datakeys)
    orbit_len = orbit_end - orbit_start

    assert((orbit_end <= time_end and orbit_start >= time_start) or (isOrbitExtended == True))

    # Anchor points from which the curve is deduced
    # anchor[t] is a list of 4 known timepoints: 2 before t + 2 after t if possible
    anchor =  [ [] ] * (orbit_len + 1)

    # Pass 1: Picking up 2 the closest points before the start of the orbit
    # and 2 after the start
    # TODO: corner case "no points after" (yes, here too)
    i = orbit_start
    future_pts = 0
    while len(anchor[0]) + future_pts < 2:
        if i in datakeys:
            anchor[0].insert(0, i)
        i -= 1
        # If we stepped outside of available points, stop
        if i < time_start:
            future_pts += 1

    i = orbit_start + 1
    while len(anchor[0]) < 4:
        if i in datakeys:
            anchor[0].append(i)
        i += 1
 
    # Pass 2: Copying the anchor over as long as no new points are encountered
    # If we do encounter a new point, shift the list to the left and add it
    last_anchor = 0
    no_pts_after = False
    for j in range(orbit_start, orbit_end + 1):
        # We are inside the gap, fill with last good value
        if (anchor[last_anchor][1 - future_pts] <= j < anchor[last_anchor][2 - future_pts]) or no_pts_after:
            anchor[j - orbit_start] = anchor[last_anchor]
        else:
            # If the left bound wasn't filled, skip the shift too
            if future_pts > 0:
                anchor[j - orbit_start] = anchor[last_anchor]
                future_pts -= 1
            else:
                while i not in datapoints:
                    i += 1
                    # If we stepped out of datapoints, just reuse the last curve
                    if i > time_end:
                        no_pts_after = True
                        anchor[j - orbit_start] = anchor[last_anchor]
                        break
                else:
                    anchor[j - orbit_start] = anchor[last_anchor][1:4] + [i]
                    last_anchor = j - orbit_start
                    i += 1

    # Pass 3: Yielding values we know and generating values we don't
    for j in range(orbit_start, orbit_end + 1):
        f, last_pts = None, None

        # NOTE: has side effects
        def predict(t):
            nonlocal f, last_pts
            # Check if we need the same points that we computed before
            l = j - orbit_start
            if last_pts != anchor[l]:
                last_pts = anchor[l]
                # Shifting all the time values by orbit_start to prevent overflows
                v = [ pt for pt in (x - orbit_start for x in anchor[l]) ]
                # Source points and components
                src_cmps = [ [ pt[i] for pt in (datapoints[z] for z in anchor[l]) ] for i in range(3) ] # NOTE: hardcode
                # If we are dealing with longitudes around 180°/-180°, shift the negatives upwards
                if any(180 < abs(src_cmps[1][x] - src_cmps[1][y]) for x in range(4) for y in range(4) if x<y):
                    src_cmps[1] = [ v + 360 if v < 0 else v for v in src_cmps[1] ]
                # Generating the cubic functions
                f = [ cubefit.cubic_fit(v, cmp) for cmp in src_cmps ]

            res_vals = [ f[i](t - orbit_start) for i in range(3) ]
            # Making sure longitude fits
            res_vals[0] = ( res_vals[0] + 180 ) % 360 - 180
            return OrbitPoint(*res_vals)

        yield j - orbit_start, datapoints[j] if j in datapoints else predict(j), False if j in datapoints else True
