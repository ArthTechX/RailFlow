import { bookingApp } from './app.js';
import { listen } from '../../../shared/http.js';
listen(bookingApp(),Number(process.env.PORT || 3003));
