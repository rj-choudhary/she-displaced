/**
 * Pre-compute hero particle dot positions.
 * Run once: node scripts/generate-hero-dots.js
 * Output: public/hero-dots.json
 * 
 * Uses a normalized coordinate system (0-1 for both x and y)
 * so dots scale to any viewport size.
 */

import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { readFileSync, writeFileSync } from 'fs'

// Simulate a 960x500 canvas (standard aspect ratio)
const W = 960
const H = 500

async function generate() {
  const resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
  const world = await resp.json()
  const land = topojson.feature(world, world.objects.land)

  const projection = d3.geoNaturalEarth1()
    .fitSize([W * 0.85, H * 0.75], land)
    .translate([W * 0.5, H * 0.52])

  const highRiskRegions = [
    [67,33],[90,24],[30,15],[45,15],[46,2],[36,-1],[38,9],[30,2],
    [32,1],[84,28],[70,30],[96,20],[105,16],[35,32],[13,12],[2,14],
    [10,10],[30,-15],[35,-14],[47,-19],[80,7],[-72,19],[120,12],
    [106,-6],[28,-2],[15,7],[25,5],[0,8],[-10,7],
  ]

  const moderateRiskRegions = [
    [78,22],[104,35],[-100,20],[-65,-15],[-76,-10],[-58,-23],
    [32,30],[3,35],[-5,32],[10,34],[44,33],[53,32],[69,41],
    [72,39],[75,41],[28,-26],[25,-14],[18,-12],
  ]

  function distToRegion(lonlat, regions) {
    let minD = Infinity
    for (const r of regions) {
      const d = Math.hypot(lonlat[0] - r[0], lonlat[1] - r[1])
      if (d < minD) minD = d
    }
    return minD
  }

  const step = 8
  const dots = []

  for (let x = 0; x < W; x += step) {
    for (let y = 0; y < H; y += step) {
      const lonlat = projection.invert([x, y])
      if (!lonlat || isNaN(lonlat[0])) continue
      if (!d3.geoContains(land, lonlat)) continue

      const highDist = distToRegion(lonlat, highRiskRegions)
      const modDist = distToRegion(lonlat, moderateRiskRegions)

      let risk
      if (highDist < 12) risk = 2       // high
      else if (modDist < 15 || highDist < 20) risk = 1  // moderate
      else risk = 0                      // low

      // Store normalized coordinates (0-1) and risk level
      // Add small jitter
      const jitter = step * 0.35
      const nx = (x + (Math.random() - 0.5) * jitter) / W
      const ny = (y + (Math.random() - 0.5) * jitter) / H

      dots.push([
        Math.round(nx * 1000) / 1000,
        Math.round(ny * 1000) / 1000,
        risk
      ])
    }
  }

  console.log(`Generated ${dots.length} dots`)
  writeFileSync('public/hero-dots.json', JSON.stringify(dots))
  console.log('Saved to public/hero-dots.json')
}

generate().catch(console.error)
