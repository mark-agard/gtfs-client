# GTFS Client

A versatile web mapping application that lets users explore real-time public transit for any U.S. city with public GTFS data.

## Overview

GTFS Client is an interactive web application that combines open transit data with modern web mapping. Users select a U.S. city from a directory of agencies that publish [GTFS](https://gtfs.org/) (General Transit Feed Specification) data. Upon selection, the application loads a map centered on the city and begins streaming live vehicle positions, routes, and stops using GTFS-realtime feeds.

This project is the spiritual successor to much less mature implementation that focused on WMATA data. I think exploring live transit data is an interesting use-case, but I decided starting anew was better than trying to retrofit the old codebase, given how early in development it was.

## Features

- **City selection** — Browse and search a catalog of U.S. transit agencies with public GTFS feeds.
- **Interactive map** — OpenLayers-based map with pan, zoom, and layer controls.
- **Live transit data** — Real-time vehicle positions streamed from GTFS-realtime feeds.
- **Route & stop visualization** — Display transit routes and stop locations as map layers.
- **Agency details** — View agency metadata, service area, and feed status.

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Frontend     | Angular (TypeScript)                |
| Mapping      | OpenLayers                          |
| Backend      | Node.js (TypeScript)                |
| Transit Data | GTFS Static + GTFS-Realtime         |
| Feed Catalog | [MobilityDatabase](https://mobilitydatabase.org/) / TransitFeeds API |

## Project Structure

```
gtfs-client/
├── client/          # Angular frontend application
├── server/          # Node.js backend API
├── docs/            # Design documents and architecture notes
└── README.md
```

## Getting Started

> **Note:** The project is in the design phase. Setup instructions will be added once scaffolding is complete.
