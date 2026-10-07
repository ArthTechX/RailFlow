import { searchApp } from './app.js';
import { listen } from '../../../shared/http.js';
listen(searchApp(),Number(process.env.PORT || 3002));
