import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/store-browser',outputDir:'./output/store-browser',timeout:35000,workers:1,fullyParallel:false,reporter:[['line'],['json',{outputFile:'output/store-test-results.json'}]],
 use:{baseURL:'http://127.0.0.1:4181',trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'node scripts/serve-store.mjs',url:'http://127.0.0.1:4181/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/',reuseExistingServer:!process.env.CI,timeout:15000},
 projects:[
  {name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},
  {name:'mobile',use:{...devices['Pixel 7'],viewport:{width:390,height:844}}},
  {name:'tablet',grep:/visual|game portal|mobile navigation/,use:{...devices['iPad Mini'],viewport:{width:768,height:1024}}},
  {name:'wide',grep:/visual/,use:{...devices['Desktop Chrome'],viewport:{width:1920,height:1080}}},
  {name:'reference',grep:/visual/,use:{...devices['Desktop Chrome'],viewport:{width:864,height:900}}},
  {name:'webkit',grep:/visual|shopping cart|game portal/,use:{...devices['Desktop Safari'],viewport:{width:1440,height:900}}}
 ]
});
