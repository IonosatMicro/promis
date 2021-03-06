#!/bin/sh

# Setting up a minimal viable config
echo "development_setup: yes" > conf/conf.yml

# Non-standard Postgres port so it won't clash with Travis machine
# TODO: maaybe just make it expose a different one on the host?
POSTGIS_PORT=4242
echo "port_sql_host: $POSTGIS_PORT" >> conf/conf.yml

# Ready, steady, go
vagrant up db.promis api.promis test.promis

# Wait for the backend to start up
while ! docker logs api.promis | grep 'at http://0.0.0.0:80/' > /dev/null; do
    echo "Backend not ready, sleeping 10 secs"
    sleep 10
done

# Display backend logs just for kicks
docker logs api.promis

# Artificial data satellites
# TODO: reactivate
# ./backend_command loaddata --format json - < test/data/test_set.json

# Load the satellite data
# TODO: use parallel or some other tool like that to have logs store both outputs
# TODO: reactivate
# ./backend_command check_data_updates 2>&1 > /tmp/fetch_data.log &

# Keeping the last call of the script happy TODO: remove
touch /tmp/fetch_data.log

# Bring the web separately as it can be a long thing
vagrant up web.promis

# Hold on while the the data update is still going on
wait

# Print out anything captured in the log
cat /tmp/fetch_data.log

