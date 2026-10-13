#!/usr/bin/env python3
"""Sync assets/icon.png — the repo icon — from the canonical Heros brand art.

The brand source of truth is pdf-studio-extension/icons/logo.png (512x512,
shared with the Heros_Markdown icon set). Run:
    python3 assets/make-icon.py
This keeps the README logo, social preview and in-app logo identical.
"""
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'pdf-studio-extension', 'icons', 'logo.png')
OUT = os.path.join(ROOT, 'assets', 'icon.png')

shutil.copyfile(SRC, OUT)
print('synced', OUT, '<-', SRC)
