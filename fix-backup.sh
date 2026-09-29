#!/bin/bash
sed -i "s|import { Component, OnInit, signal, inject } from '@angular/core';|import { Component, OnInit, signal, inject } from '@angular/core';\nimport { environment } from '../../../environments/environment';|g" frontend/src/app/pages/settings/backup-restore.component.ts
