/*
    Enhanced Tuning Plugin
    Server-side code for serving static assets (CSS).
*/

'use strict';

const path = require('path');
const express = require('express');
const endpointsRouter = require('../../server/endpoints');

endpointsRouter.use(
  '/public',
  express.static(path.join(__dirname, 'public'))
);
