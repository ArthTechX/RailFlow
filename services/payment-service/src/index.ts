import { paymentApp } from './app.js';
import { listen } from '../../../shared/http.js';
listen(paymentApp(),Number(process.env.PORT || 3004));
