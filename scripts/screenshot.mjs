#!/usr/bin/env node
/**
 * screenshot.mjs — captura el board (debe haber un server corriendo en :5199)
 * Uso: node scripts/screenshot.mjs [ruta_salida]
 */
import { chromium } from 'playwright'

const OUT = process.argv[2] ?? 'assets/screenshot.png'
const BASE = 'http://localhost:5199/'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: OUT, fullPage: false })
await browser.close()
console.log('screenshot →', OUT)