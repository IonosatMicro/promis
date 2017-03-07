# -*- coding: utf-8 -*-
# Generated by Django 1.10.5 on 2017-03-06 13:04
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('backend_api', '0005_auto_20170223_1142'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='space_project',
            options={'verbose_name': 'Space project', 'verbose_name_plural': 'Space projects'},
        ),
        migrations.AddField(
            model_name='session',
            name='satellite',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to='backend_api.Space_project'),
        ),
    ]
