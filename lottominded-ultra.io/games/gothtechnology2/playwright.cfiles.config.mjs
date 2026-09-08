import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
 testDir:'./tests/cfiles',workers:1,timeout:35000,reporter:'line',
 outputDir:process.env.CFILES_TEST_OUTPUT||'output/cfiles-tests',
 use:{baseURL:'http://127.0.0.1:4186',viewport:{width:1536,height:1024},screenshot:'only-on-failure'},
 webServer:{command:'node scripts/cfiles/server.mjs',url:'http://127.0.0.1:4186/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/c-files/api/health',reuseExistingServer:false,env:{CFILES_PORT:'4186',CFILES_DATA_DIR:process.env.CFILES_TEST_DATA||resolve('output','cfiles-test-'+Date.now())}}
});
