#!/usr/bin/env python3
from math   import pi, atan, exp, sin, cos
from json   import dumps
from random import seed, randint
from os     import path, makedirs
from time   import time

### Globals are bad
### Call the cops, I don't care
random_seed = 42

# Points per orbit segment
orbit_pts = 20

# Time slice (seconds) between two point
orbit_sec = 1

# Number of times "Roundabout" turns around Earth
round_turns = 30

# Time flow is multiplied by this constant for roundabout
slow_factor = 0.3

# Meridian speed, something like degrees per latitudal revolution
round_shift = 272 # not multiple of 90

# Amount of points per specific orbit
heart_pts = int(4*60/orbit_sec)                     # 4 mins
peace_pts = int(2*60/orbit_sec)                     # 2 mins
lines_pts = int(1*60/orbit_sec)                     # 1 mins
round_pts = int(round_turns*2*60/orbit_sec)         # 2 mins for 1 revolution

# Times at the start of the orbit, UNIX seconds
heart_start = 0
peace_start = heart_start + 3600
lines_start = peace_start + 3600
utick_start = lines_start + 3600

# Roundabout represents "fresh data"
round_start = int(time())

# TODO: make a proper satellite orbit
# TODO: ask why we have 2 lines on the original orbit (MultiLineString)
# TODO: sql injection prevention (not that it's a concern for tests, but ..)

# Fake mercator considering Earth is a sphere
def cord_conv(y, x):
    return [ float(x), 180.0/pi*(2.0*atan(exp(y*pi/180.0))-pi/2.0), 400 ]

# Ensures the number doesn't exceed 180
def clamp180(x):
    return (x+180)%360-180 if x > 180 else x

# TODO: aspect ratio maaaybe?

### Satellite "Love&Peace" somehow flies an orbit that is projected as a heart and pacific sign

# Heart shape
def heart():
    return [ cord_conv(3*13*cos(t)-3*5*cos(2*t)-3*2*cos(3*t)-3*cos(4*t), -90+4*16*sin(t)**3)
        for t in ((i-heart_pts/2)/(heart_pts*0.165)
            for i in range(heart_pts))]
# Circle
def circle():
    return [ cord_conv(30*sin(t), 90+60*cos(t))
        for t in ((2*pi*i/peace_pts)
            for i in range(peace_pts)) ]

# Vertical line [-45;45]
def vline():
    return [ cord_conv(t*35, 90)
        for t in (2*(float(i)/lines_pts-0.5)
            for i in range(lines_pts))]

# Upwards tick
def uptick():
    return [ cord_conv(-5-abs(t*30), 90+t*50)
        for t in (2*(float(i)/lines_pts-0.5)
            for i in range(lines_pts))]

### Satellite "Roundabout" starts at equator on longitude 0 slowly changes meridians

# Yes I know this is not how satellites work
def roundabout():
    return [ [ clamp180(round_shift*t/pi), 80*sin(t), 300 + 200*cos(t) ]
        for t in ((2*slow_factor*round_turns*pi*i/round_pts)
            for i in range(round_pts))]

# Thx, stackoverflow
def chunks(l, n):
    for i in range(0, len(l), n):
        yield l[i:i + n]

def ensuredir(folder):
    if not path.exists(folder):
        makedirs(folder)

### Inserting data generated
def insert_orbit(folder, start_time, gen_func, data_func=None):
    ensuredir(folder)

    time = start_time

    for v in chunks(gen_func(), orbit_pts):
        new_time = time + orbit_pts * orbit_sec
        # TODO: orbit_code is defaulted to NULL
        sessfolder = "%s/%010d/" % (folder, time)

        ensuredir(sessfolder)

        with open("%s/orbit.csv" % sessfolder, "w") as fp:
            for pt in v:
                print(",".join(str(x) for x in pt), file=fp)

        # Generate some data
        if data_func:
            # TODO: parametrise the call somehow?
            docs = data_func()
            docnames = ( "channel", "parameter" )

            for i in range(2):
                with open("%s/%s.json" % (sessfolder, docnames[i]), "w") as fp:
                    print(dumps(docs[i]), file=fp)

        time = new_time

def gen_space_temp():
    freq = 100
    amps = [ randint(50,100) for i in range(freq*orbit_sec) ]
    # pure sine turns to zero too often
    mv = [ amps[i]*(2+sin(4*2*pi*i/(freq*orbit_sec))) for i in range(freq*orbit_sec) ]

    return mv, amps

# Seed the PRNG
seed(random_seed)

# Ready, steady, go!
insert_orbit("peace_love/heart", heart_start, heart, gen_space_temp)
insert_orbit("peace_love/circle", peace_start, circle, gen_space_temp)
insert_orbit("peace_love/vline", lines_start, vline, gen_space_temp)
insert_orbit("peace_love/uptick", utick_start, uptick, gen_space_temp)

# TODO: break into several datapoints ("days")
# TODO: make short and long sessions
# TODO: variable frequencies et al
insert_orbit("roundabout/wholeproject", round_start, roundabout, gen_space_temp)
