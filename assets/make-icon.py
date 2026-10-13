#!/usr/bin/env python3
"""Sync assets/icons/ — the repo icon set — from the canonical Heros brand art.

Source of truth: pdf-studio-extension/icons/ (the app icon set, shared with
the Heros_Markdown icon set: 16/32/48/128, apple-touch-icon, logo).
Run:  python3 assets/make-icon.py
This keeps the README logo, social preview and in-app icons identical.
"""
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, 'pdf-studio-extension', 'icons')
OUT_DIR = os.path.join(ROOT, 'assets', 'icons')

FILES = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png',
         'apple-touch-icon.png', 'logo.png']

os.makedirs(OUT_DIR, exist_ok=True)
for name in FILES:
    shutil.copyfile(os.path.join(SRC_DIR, name), os.path.join(OUT_DIR, name))
    print('synced', os.path.join('assets/icons', name))
