from rest_framework import serializers
from backend_api import models

from rest_framework.fields import ReadOnlyField, SerializerMethodField
from rest_framework.reverse import reverse
from djsw_wrapper.serializers import SwaggerHyperlinkedRelatedField
from hvad.contrib.restframework import TranslatableModelSerializer, HyperlinkedTranslatableModelSerializer
from rest_framework_gis.serializers import GeoModelSerializer

from django.utils.translation import get_language

from django.contrib.gis.geos.collections import MultiLineString
from django.contrib.gis.geos import GEOSGeometry, GEOSException

import json

from django.contrib.auth.models import User
from django.contrib.auth.models import Group
from backend_api import helpers
import parsers
import unix_time
import math


class LookupById:
    '''Shortcut to include extra_kwargs to every Meta class'''
    extra_kwargs = { 'url': { 'lookup_field': 'id' } }


class SpaceProjectsSerializer(TranslatableModelSerializer):
    timelapse = serializers.SerializerMethodField()

    def get_timelapse(self, obj):
        # TODO: start and end are a DATE not DATETIME, but we convert them implicitly
        return { 'start': unix_time.datetime_to_utc(obj.date_start),
                 'end': unix_time.datetime_to_utc(obj.date_end) }

    class Meta(LookupById):
        model = models.Space_project
        fields = ('id', 'url', 'name', 'description', 'timelapse')


class ChannelsSerializer(TranslatableModelSerializer):
    class Meta(LookupById):
        fields = ('id', 'url', 'name', 'description')
        model = models.Channel


class ParametersSerializer(TranslatableModelSerializer):
    channel = SwaggerHyperlinkedRelatedField(many = False, read_only = True, view_name = 'channel-detail')

    class Meta(LookupById):
        fields = ('id', 'url', 'name', 'description', 'channel')
        model = models.Parameter


class DevicesSerializer(TranslatableModelSerializer):
    space_project = SwaggerHyperlinkedRelatedField(many = False, read_only = True, view_name = 'space_project-detail')
    channels = SwaggerHyperlinkedRelatedField(many = True, read_only = True, view_name = 'channel-detail')

    class Meta(LookupById):
        model = models.Device
        fields = ('id', 'url', 'name', 'description', 'space_project', 'channels')


class SessionsSerializer(serializers.ModelSerializer):
    # TODO: STUB, see #196
    #measurements = SwaggerHyperlinkedRelatedField(many = True, read_only = True, view_name = 'measurement-detail')
    # cut from here:
    measurements = SerializerMethodField()
    def get_measurements(self, obj):
        return (self.context['request'].build_absolute_uri('/api/measurements/' + str(m.id))
                    for m in models.Measurement.objects.filter(session = obj))
    # to here ^

    space_project = SwaggerHyperlinkedRelatedField(many = False, read_only = True, view_name = 'space_project-detail')

    geo_line = serializers.SerializerMethodField()
    timelapse = serializers.SerializerMethodField()

    def get_geo_line(self, obj):
        # Just in case for the future
        #return obj.geo_line.wkb.hex()

        # TODO: study whether pre-building the list or JSON would speed up things
        # TODO: ugly hack before #256
        # geo_line.wkb calls a generator implicitly
        return ( (*geo[:2], alt) for alt, geo in zip(obj.altitude, parsers.wkb(obj.geo_line.wkb)) )   

    def get_timelapse(self, obj):
        # TODO: change to time_start in model for consistency
        return { 'start': unix_time.datetime_to_utc(obj.time_begin),
                 'end': unix_time.datetime_to_utc(obj.time_end) }


    class Meta(LookupById):
        model = models.Session
        fields = ('id', 'url', 'space_project', 'orbit_code', 'geo_line', 'timelapse', 'measurements')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # If we are serializing a list of sessions, don't include the geo_line
        if type(args[0]) is list:
            self.fields.pop('geo_line')


class QuicklookSerializer(serializers.Serializer):
    data = serializers.SerializerMethodField()
    timelapse = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()
    value = serializers.SerializerMethodField()

    def unit_prefix(self, e):
        prefixes = {
            18: { 'en': 'E', 'uk': 'Е' },
            15: { 'en': 'P', 'uk': 'П' },
            12: { 'en': 'T', 'uk': 'Т' },
            9:  { 'en': 'G', 'uk': 'Г' },
            6:  { 'en': 'M', 'uk': 'М' },
            3:  { 'en': 'k', 'uk': 'к' },
            2:  { 'en': 'h', 'uk': 'г' },
            1:  { 'en': 'da', 'uk': 'да' },
            0:  { 'en': '', 'uk': '' },
            -1: { 'en': 'd', 'uk': 'д' },
            -2: { 'en': 'c', 'uk': 'с' },
            -3: { 'en': 'm', 'uk': 'м' },
            -6: { 'en': 'μ', 'uk': 'мк' },
            -9: { 'en': 'n', 'uk': 'н' },
            -12:{ 'en': 'p', 'uk': 'п' },
            -15:{ 'en': 'f', 'uk': 'ф' },
            -18:{ 'en': 'a', 'uk': 'а' },
        }
        lang = get_language()
        return prefixes[e]['en' if not lang else lang] if e in prefixes else "?"

    def get_source(self, obj):
        # Preparing the serializer
        ser_cls = { 'channel': ChannelsSerializer, 'parameter': ParametersSerializer }[ self.source_name() ]
        res = ser_cls(self.source_obj(), context = self.context).data

        # Injecting some additional information
        res.update({'type': self.source_name() })

        return res

    def get_timelapse(self, obj):
        time_filter = self.context['view'].time_filter
        return { 'start': time_filter[0] if time_filter[0] else unix_time.datetime_to_utc(obj.session.time_begin),
                 'end': time_filter[1] if time_filter[1] else unix_time.datetime_to_utc(obj.session.time_end) }

    def get_value(self, obj):
        src = self.source_obj()
        return { 'short_name': src.value.short_name,
                 'name'      : src.value.name,
                 'units'     : self.unit_prefix(src.exponent) + src.value.units.short_name,
                 'units_name': src.value.units.long_name }

    def get_data(self, obj):
        doc_obj = obj.instance(self.source_name())
        return doc_obj.quicklook(self.context['view'].points, doc_obj.timeslice(*self.context['view'].time_filter))

    def source_name(self):
        # TODO: swagger should do the default here
        return self.context['request'].query_params.get('source', 'parameter')

    def source_obj(self):
        '''Returns a source model object (parameter or channel)'''
        return getattr(self.instance, self.source_name())


class JSONDataSerializer(QuicklookSerializer):
    geo_line = serializers.SerializerMethodField()
    sampling_frequency = serializers.SerializerMethodField()

    def get_geo_line(self, obj):
        # Determining which part of the geo_line to cut
        timelapse = self.get_timelapse(obj)
        sess_dur  = SessionsSerializer(obj.session, context = self.context).get_timelapse(obj.session)
        skip_start = timelapse['start'] - sess_dur['start']
        skip_end = timelapse['end'] - sess_dur['start']

        # TODO: pre-cache the computation of the list somewhere?
        geo_line = SessionsSerializer(obj.session, context = self.context).get_geo_line(obj.session)

        return (v for i, v in enumerate(geo_line) if skip_start <= i < skip_end)

    def get_data(self, obj):
        doc_obj = obj.instance(self.source_name())
        return doc_obj.data(doc_obj.timeslice(*self.context['view'].time_filter))

    def get_sampling_frequency(self, obj):
        return obj.sampling_frequency


class MeasurementsSerializer(serializers.ModelSerializer):
    session = SwaggerHyperlinkedRelatedField(many = False, view_name = 'session-detail', read_only = True)
    channel = SwaggerHyperlinkedRelatedField(many = False, view_name = 'channel-detail', read_only = True)
    parameter = SwaggerHyperlinkedRelatedField(many = False, view_name = 'parameter-detail', read_only = True)
    channel_quicklook = serializers.SerializerMethodField()
    channel_download = serializers.SerializerMethodField()
    parameter_quicklook = serializers.SerializerMethodField()
    parameter_download = serializers.SerializerMethodField()


    class Meta(LookupById):
        # TODO: add 'url' here, currently it's broken, see #196
        fields = ('id', 'session', 'parameter', 'channel', 'sampling_frequency', 'min_frequency', 'max_frequency', 'channel_quicklook', 'channel_download', 'parameter_quicklook', 'parameter_download')
        model = models.Measurement

    #TODO: SPIKE: remove below hard code and replace to related view path.
    def construct_data_url(self, obj, source, action):
        id = getattr(obj, source + "_doc").id
        return self.context['request'].build_absolute_uri('/api/download/%d/%s?source=%s' % (id, action, source))

    def get_channel_quicklook(self, obj):
        return self.construct_data_url(obj, "channel", "quicklook")
    def get_channel_download(self, obj):
        return self.construct_data_url(obj, "channel", "download")
    def get_parameter_quicklook(self, obj):
        return self.construct_data_url(obj, "parameter", "quicklook")
    def get_parameter_download(self, obj):
        return self.construct_data_url(obj, "parameter", "download")
    # cut here ^

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        user = self.context['request'].user
        if not (helpers.UserInGroup(user, 'level1') or helpers.IsSuperUser(user)):
            self.fields.pop('channel_download')
        if not user.is_authenticated():
            self.fields.pop('parameter_download')


class UserSerializer(serializers.ModelSerializer):

    password = serializers.CharField(
          write_only=True,
    )

    date_joined = serializers.DateTimeField(read_only = True)
    last_login = serializers.DateTimeField(read_only = True)

    class Meta:
       model = User
       fields = ('password', 'username', 'first_name', 'last_name', 'date_joined', 'last_login')

    def create(self, validated_data):
        user = super().create(validated_data)
        if 'password' in validated_data:
              user.set_password(validated_data['password'])

        user.save()

        return user

    def update(self, instance, validated_data):
        if 'password' in validated_data:
            password = validated_data.pop('password')
            instance.set_password(password)
        return super().update(instance, validated_data)

# TODO: REFACTOR, alpha code below
class DataSerializer(serializers.ModelSerializer):
    session = SwaggerHyperlinkedRelatedField(many = False, view_name = 'session-detail', read_only = True)
    channel = SwaggerHyperlinkedRelatedField(many = False, view_name = 'channel-detail', read_only = True)
    parameter = SwaggerHyperlinkedRelatedField(many = False, view_name = 'parameter-detail', read_only = True)
    selection = serializers.SerializerMethodField()


    class Meta(LookupById):
        # TODO: add 'url' here, currently it's broken, see #196
        fields = ('id', 'session', 'parameter', 'channel', 'sampling_frequency', 'min_frequency', 'max_frequency', 'selection')
        model = models.Measurement

    def get_selection(self, obj):
        def gen_selection():
            # Extracting request information
            poly = self.context['request'].query_params.get('polygon')
            time_begin = self.context['request'].query_params.get('time_begin')
            time_end = self.context['request'].query_params.get('time_end')

            # Agreeing on time boundaries
            session_start = unix_time.datetime_to_utc(obj.session.time_begin)
            session_end = unix_time.datetime_to_utc(obj.session.time_end)
            time_begin = int(time_begin) if time_begin else session_start
            time_end = int(time_end) if time_end else session_end

            # Convert polygon to GEOS object as intersection doesn't auto-convert
            if poly:
                try:
                    poly = GEOSGeometry(poly, srid = 4326)

                    # FIXME: Django's GEOS implementation
                    # doesn't support 4D linestrings
                    # TODO: patch upstream, it's horrible!

                    # Intersection of search polygon and the orbit
                    isect = obj.session.geo_line.intersection(poly)

                    # Making sure isect is a collection of geolines, not a single one
                    if type(isect) is not MultiLineString:
                        isect = [ isect ]

                    for sect in isect:
                        # Pick up two ends
                        sect_start, sect_end = sect[0][2], sect[-1][2]

                        # Reverse start and end if necessary
                        if sect_end < sect_start:
                            sect_end, sect_start = sect_start, sect_end

                        # NOTE: taking the first and last point within the selection
                        sect_start = math.ceil(sect_start) + session_start
                        sect_end = math.floor(sect_end) + session_start

                        # If the data not within time selection, skip completely
                        if sect_end < time_begin or sect_start > time_end:
                            continue

                        yield max(time_begin, sect_start), min(time_end, sect_end)


                except ValueError:
                    raise NotFound("Invalid WKT for polygon selection")
            # Otherwise take the whole session, just make sure to trim the time values
            else:
                yield max(time_begin, session_start), min(time_end, session_end)

        # Generate a list of tuples, sort them, then convert to list of dictionaries
        # TODO: data links
        res = sorted(x for x in gen_selection())
        return [ { 'start': x[0], 'end': x[1] } for x in res ]
