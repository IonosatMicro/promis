#!/bin/sh
PROMIS_DIR=`dirname $0`

# Wait until the database is up and insert the SRID 4979 definition for 3D points
# TODO: currently not in use #222
python $PROMIS_DIR/prepare_db.py < $PROMIS_DIR/add_srid_4979.sql

# Migrate data if needed
python $PROMIS_DIR/promis/manage.py makemigrations --no-input
python $PROMIS_DIR/promis/manage.py migrate

# Record the available classes
python $PROMIS_DIR/promis/manage.py collect_classes

# Create superuser if needed
python $PROMIS_DIR/promis/manage.py batch_create_superuser

# Add initial Potential data
python $PROMIS_DIR/promis/manage.py loaddata init_data.json

#Load group and permissions info
python $PROMIS_DIR/promis/manage.py loaddata groups.json

# Generate a diagram for the frontend
python $PROMIS_DIR/promis/manage.py graph_models -a > $SYNC_DIR/model.dot

# Generate static assets
python $PROMIS_DIR/promis/manage.py collectstatic --no-input

# Run the server specified by config
case $DJANGO_TYPE in
  dev|profile)
  # Enable proflinig if needed
  if [ "$DJANGO_TYPE" = "profile" ]; then
      if [ ! -d $SYNC_DIR/profiling ]; then
          echo "=> Creating sync/profiling directory."
          mkdir $SYNC_DIR/profiling
      else
          echo "=> sync/profiling directory exists."
      fi
      SERVER_COMMAND="runprofileserver --use-cprofile --nostatic --prof-path $SYNC_DIR/profiling"
  else
      SERVER_COMMAND="runserver"
  fi

  # Run the actual server
  python $PROMIS_DIR/promis/manage.py $SERVER_COMMAND 0.0.0.0:80
  ;;

  unicorn)
  gunicorn -b 0.0.0.0:80 promis.wsgi --chdir $PROMIS_DIR/promis
  ;;

  *) echo "I don't know how to run Django in $DJANGO_TYPE mode!"
  exit 1
  ;;
esac
