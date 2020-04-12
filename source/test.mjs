"use strict";
import ReadPam from './ReadPam.mjs';
import fs from 'fs';
const PamName = process.argv[2];
!fs.existsSync('./output/') && fs.mkdirSync('./output/');
new ReadPam(PamName).start(`./output/`);