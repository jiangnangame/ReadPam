import ReadPam from '../source/ReadPam.mjs';
import fs from 'fs';
import path from 'path';
const dir = '../example/';
fs.readdirSync(dir).forEach(value => {
    let stats = fs.statSync(path.join(dir,value));
    if(stats.isFile()) {
        let url = path.join(dir, value);
        !fs.existsSync('./test-output/') && fs.mkdirSync('./test-output/');
        new ReadPam(url).start(`./test-output/`);
    }
});    