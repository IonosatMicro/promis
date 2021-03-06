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
from django.core.management.base import BaseCommand

import classes
import re
import backend_api.models as model

from pkgutil import walk_packages
from importlib import import_module
from inspect import getmembers, isclass

class Command(BaseCommand):
    def handle(self, *args, **options):
        # Iterating over the modules in "classes" package
        for _, modname, _ in walk_packages(path=classes.__path__, prefix=classes.__name__+'.'):
            # Picking up classes which have docstrings from the module
            for f in (o for o in getmembers(import_module(modname)) if isclass(o[1]) and o[1].__doc__):
                cls_name = "%s.%s" % (modname, f[0])

                # Only adding a new object if there is nothing like that in the database
                if model.Class.objects.filter(name=cls_name).count() > 0:
                    continue

                rexp = r"\[([a-z]{2})\]:(.*?)(?=(\s\[[a-z]{2}\]:|$))"

                # Trying to find the first language
                m = re.search(rexp, f[1].__doc__, flags = re.S)
                if not m:
                    continue
                print("=> New class: '%s'" % cls_name)

                # Creating a first language (usually English) version
                obj = model.Class.objects.language(m.group(1)).create(name = cls_name, description = m.group(2).strip())

                # Adding the rest of the translations
                for mm in re.finditer(rexp, f[1].__doc__[ m.end(): ], flags = re.S):
                    obj.translate(mm.group(1))
                    obj.description = mm.group(2).strip()

                # Committing to the DB
                # TODO: verify that translate() doesn't discard unsaved changes
                obj.save()
