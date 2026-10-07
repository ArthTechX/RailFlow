import { authApp } from './app.js';
import { listen } from '../../../shared/http.js';
listen(authApp(),Number(process.env.PORT || 3001));
