import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
    title: 'GTFS Client — Select a City',
  },
  {
    path: 'agency/:id',
    loadComponent: () =>
      import('./features/map/map-page.component').then((m) => m.MapPageComponent),
    title: 'GTFS Client — Live Transit Map',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
