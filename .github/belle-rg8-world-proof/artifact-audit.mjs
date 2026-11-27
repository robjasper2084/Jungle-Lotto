/** Read-only, dependency-free verification of a downloaded full-world proof artifact. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync} from 'node:fs';
import {readdir} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {gunzipSync} from 'node:zlib';

const BASELINE='75906273c0cd414c0d004320fc6f654b4783e5b1',BASELINE_TREE='9f0351be133dd370a676090d27559a0adaf00605';
const CANDIDATE='ef341f2f91a43aec26261f2778404ca7346de9a9',CANDIDATE_TREE='24188d608d8f54cf6aafd9d669e6a529252cbdc8';
const SOURCE_ROOT='lottominded-ultra.io/games/gothtechnology2/',GAME=SOURCE_ROOT+'belle-isle-source/game';
const PROOF='.github/belle-rg8-world-proof',WIDTH=960,HEIGHT=600,MAX_RAW=64*1024*1024;
const STYLES=['authentic','golden','noir','detroit2084'];
const CASES=['jefferson-day','jefferson-night','island-day','island-night','conservatory-day','conservatory-night','ramp-grazing-day','under-ramp-day'];
const PARTITIONS={all:CASES,'linux-a':CASES.slice(0,4),'linux-b':CASES.slice(4)};
const LANES=['original','rg8','restored'],CONTROL_LANES=['lost-g','lost-g-restored','shadow-off','shadow-restored'];
const PROOF_FILES=[PROOF+'/artifact-audit.mjs',PROOF+'/browser.ts',PROOF+'/driver.mjs',PROOF+'/source-manifest.json','.github/workflows/belle-rg8-world-proof.yml'].sort();
const THREE={RGBAFormat:1023,RGFormat:1030,RedFormat:1028,UnsignedByteType:1009,NoColorSpace:'',RepeatWrapping:1000,LinearFilter:1006,LinearMipmapLinearFilter:1008};
// Exact immutable packages and the complete194-module transformed graph.
const SOURCE_PINS={"lottominded-ultra.io/games/gothtechnology2/package.json":{"blob":"dacb04e89117b51135c164f6079c09d44caee7fa","sha256":"b7849345af649ba60ce5c8c1c95203c5e8eb3f2fe2a31ae29d63ab665df3b2f7","bytes":1858},"lottominded-ultra.io/games/gothtechnology2/package-lock.json":{"blob":"ec14f2b0c173dc030eda273c4e206b2649712552","sha256":"a54bba2d2b6226f3b8562c4b52f4be468af15d85ff8c0d992351bf9a3c5f8d32","bytes":161941},"lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/package.json":{"blob":"b29f57eaabd6aa44f3fe9d5314fe1286758e9490","sha256":"7b2c4da476587cab12a33c31f43a596c526f53775647b88e586b46dd2bb9c246","bytes":1294},"lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/package-lock.json":{"blob":"5ef4effc86aaa257620ab2c8d60d47b6c85965e4","sha256":"105e85e781044feb8f590a3ea1e5bd0e98bb20f5512dcb1aedab30a7af0686f2","bytes":42217}};
const MODULE_INVENTORY_SHA256="80b558038fb969625f8c8fa6a99deb0720e2f31eb1827297110560760b3419f2";
const DEPENDENCY_PINS={"fflate/esm/browser.js":"b7ca4450b19559a1d50eb381adcee94b82449674be4cd17789d9beba7e6122a1","three/build/three.core.js":"3718df126d69c125362a03340913204470d8c50238605150e57f808840fb7759","three/build/three.module.js":"bbf5ed13fe4373f5bd38b14ea8e62e9f157327da5638edc6d3863e08b167c9c7","three/examples/jsm/libs/meshopt_decoder.module.js":"d428e73a000057c6c94bfcedc3412d0c2dc14ca8800e88553aab05113ad2bf19","three/examples/jsm/loaders/GLTFLoader.js":"97642d720f16cc9a0c9844934198e4d0c023bea8e89576d0f7545d03b2d103d2","three/examples/jsm/loaders/HDRLoader.js":"0986b578f9acd14cec74e5ee85e07f45e681b40bcd229a601a0391201f9b5ff1","three/examples/jsm/utils/BufferGeometryUtils.js":"5c552223a9309883743b80538d6e9cdb45e3227f30d3ec56fb2c39b46e78d595","three/examples/jsm/utils/SkeletonUtils.js":"b1632a703206c3d830de9fcbe515696770d04b71a15ee6b50afa6d2c3298c86f"};
// All194 original public/model assets are pinned; only actually requested files need receipts.
const ASSET_PINS=Object.fromEntries([
 ["public/audio/swoop/belle-audio-provenance.json",{"blob":"d2c7eb5bfa422266fb9ce1d9a089413bb344a794","sha256":"aef3815abd0c8554e5cb849b87db95ac5ea358c6e2961c8583c0d42194f56793","bytes":2571}],
 ["public/audio/swoop/track-01.mp3",{"blob":"ad24bc31bdd4fbb7f9127895678ff3aa31d12a75","sha256":"c52ffbde5a1acb346674e314fa16117b928f05a9d5ca0726b43ecfbdfa1f13c6","bytes":3087090}],
 ["public/audio/swoop/track-02.mp3",{"blob":"ca11874d438ff9724b094639adec55accb04f672","sha256":"bc1d7fce993131a1a4e880b038c8a2f4b3e13de683be4b8016d1a7db874abdc7","bytes":2613124}],
 ["public/audio/swoop/track-03.mp3",{"blob":"4db3c2e0acd330d1048792360d0ed69a745ef68f","sha256":"31ba7dbb4c4a48a42986d7ab5ffbe4a93fef180907345820b2858ebb3eafa455","bytes":1200004}],
 ["public/audio/swoop/track-05.mp3",{"blob":"35ad52234a2fc270b7b0eb92306834948a52dd9b","sha256":"ac53c30054c5e47e2b646ee0a4b7512a805c4309780b2cf6507d09cc90160bee","bytes":932928}],
 ["public/audio/swoop/track-06.mp3",{"blob":"fd97414690dbafb7f9164621d2606611640018c2","sha256":"25f3f41dbdc1842fc3a4e38ca72ac89cd0137f0dad3fd1db4cfaf68277835d37","bytes":1463319}],
 ["public/audio/swoop/track-07.mp3",{"blob":"054c4d9c81d51940641512f8f9825e624ccee004","sha256":"791ffe2b4dad51868b5b7f86cb3d6435f8886bdc45cb670e1fa6db6f8f948c1f","bytes":1039926}],
 ["public/audio/swoop/track-08.mp3",{"blob":"8e2aabdeecb77caaed9f1286c406c07313c840f0","sha256":"c325d4a2996fa55933d5596a26a96f89bcc9e89fbec0f33a0d249e238c8fc7ff","bytes":1108889}],
 ["public/audio/swoop/track-09.mp3",{"blob":"e994f2744539dd658782b8157785a9a23116bd61","sha256":"7dfb48c8a1a8311b16b11b134f8f57ee4486df96d3d7f49478c24760c5daf682","bytes":4897689}],
 ["public/audio/swoop/track-10.mp3",{"blob":"e5b0d7d1a985cdb1b9648948e2018ed01f6a11fe","sha256":"dcd9770c09a817da1edea322d6689a6bfa044e0e33e4e56b947b93daf4e53389","bytes":2861392}],
 ["public/audio/swoop/track-11.mp3",{"blob":"d91f45bfd0b2ba5c2cd0c53ad6d17c2b57414264","sha256":"cfce1a3d96875e38b157a20c619f13fe262bb15cd1aaa97111ce76ee5e9443e4","bytes":420093}],
 ["public/audio/swoop/track-14.mp3",{"blob":"cd682933f1bf6204e494b30b218417eac38caf62","sha256":"6759473d58d8fba52c4dd6b01e65b59c7dce282ec1d9de00609a30b6a84e6ef8","bytes":1072527}],
 ["public/audio/swoop/track-15.mp3",{"blob":"ac334dac41a6af9f6916a095f1ff890172dc451b","sha256":"a8ab17fd0f5ea0fe039b1cf7707deddc5da90db74eb4904f8a2fba1f5569a35e","bytes":2294222}],
 ["public/audio/swoop/track-17.mp3",{"blob":"e79896ae7e1bed4d9ceb6489d3edb713dfdc0932","sha256":"45edd010b744d00699ea64ab8ecb3452fe4959eaf6d6406acc8f8d27a2cbdc5a","bytes":1699466}],
 ["public/audio/swoop/track-18.mp3",{"blob":"9cf80cf236578b40fc670b17dbfb5ae3fb088c40","sha256":"aea4a082bb731cfd566b3243105c19147adac52bb574a38532367aba15674210","bytes":2400383}],
 ["public/audio/swoop/track-19.mp3",{"blob":"ba3c1c5712b8652f9ae53415a2897fd00bdee8ed","sha256":"584059015f022743cb637c96834ce6b0cb6be0dc9be8db0260ecd939dab74b95","bytes":2765679}],
 ["public/audio/swoop/track-20.mp3",{"blob":"6c28149c79a8f18ba87398c9ed121c21fe2c0373","sha256":"1e2d8a996923f34ed9024f570ae75ebc9be21c170c236a10bc2e9f7398d24f66","bytes":2845092}],
 ["public/audio/swoop/track-21.mp3",{"blob":"9c13f709d8f4f523d67d43e0939190f2f498217a","sha256":"a5522179a1db9e33fc8be8b22ff8589d43df8e81af7eeff10a696a460fbf144d","bytes":3304847}],
 ["public/audio/swoop/track-23.mp3",{"blob":"6b5d51330d16b2dbeb3a0cc972b02ead84df7329","sha256":"3e89997e8364cd9d5c6607c6333c25fe3f436b40cbb67aa13c54b8df3c61d4b4","bytes":3026904}],
 ["public/audio/swoop/track-24.mp3",{"blob":"6e17ec27cec31e6483c43cf67546abacc4481232","sha256":"9c7a73f6ba3c793b9af017eddab6cfae6c6d4cd79b8631be0f4844101a6309f3","bytes":4631031}],
 ["public/belle/audio/LICENSE.md",{"blob":"142e74780968b7f98da2cd589185fb2bbeb8caf0","sha256":"d4c6c697c67848c46544e2b1b8a7c68ff4fa4fadcf4ca077243233fae21156fd","bytes":368}],
 ["public/belle/audio/park-birdsong.mp3",{"blob":"e61cc3593ae63a717dc570ccbae17cba56aeeca4","sha256":"d08b08bd2497886f52ea19759737f74d1379374efacc486272b50032c107d321","bytes":357086}],
 ["public/belle/beach-land.json",{"blob":"a36807aa0e3887d29e4718c349321c29bbce94de","sha256":"9a10661864fab731d43dc64c94a30fd57e58a3d5ea71028d04e754bbef2a3440","bytes":48824}],
 ["public/belle/beach-surface.bin",{"blob":"079ff18f63a294f07755880d59c3103391ac30b9","sha256":"9a32db02077720b0dfdb8beeab6f3061baf0b655e8f7bf51b52fce8802879c88","bytes":228160}],
 ["public/belle/beach-surface.json",{"blob":"3d435898e5c6cf1a37887b70169a2184d4bf886f","sha256":"7810b99e9de1bfe39c0d516fb68ede817307626aa70b05c0ecff2c7297276b2f","bytes":198168}],
 ["public/belle/birds/LICENSE.txt",{"blob":"943df27efee6a60eb535c31752f8b4da0eed324f","sha256":"01270a51ed3ab5d51270b6015ca875a879a64eb05a67e24f4a84114ce098c5b2","bytes":402}],
 ["public/belle/birds/pigeon.glb",{"blob":"564a0f83bc9e30ce8623bf4383c947026a7647d0","sha256":"ef719250d6fdb01d4e7d1224d92339e5787d7a52d3470ef883d557ef6cd4cefc","bytes":129740}],
 ["public/belle/cameras/bass.glb",{"blob":"5a609e71b738c5d7121dc3738c53c43d0f93b4f9","sha256":"b6aceba289e69b9bc05e7d1ee0e846b5d956f2a4e633d10fe625a87188b969d0","bytes":86384}],
 ["public/belle/cameras/heart.glb",{"blob":"987109d5215a6ae58e94cf3328f904ad908ab308","sha256":"3bda0c3d4ba6af5bc83a8029b9642b3eb147c81ccc827b6a72bdd34921469392","bytes":154768}],
 ["public/belle/cameras/static.glb",{"blob":"f2a904a1823db521a9fbf822727af71899f5bdb7","sha256":"a5ce67a53a87d88cb483842f9929057df6333b9602c8947ee62315a4cd73069b","bytes":76240}],
 ["public/belle/detroit-skyline.glb",{"blob":"6f5a5ac5b2720f5e4719944e7e4208637ddefaf5","sha256":"987a3366c0964856615cb14ac51c010a615da42a00fd7b06fd2480f8cafd30a1","bytes":2788944}],
 ["public/belle/environment/kloppenheim-06-2k.hdr",{"blob":"5a3e80bda83c6feec7ad76387de2c24d41959a88","sha256":"99451201586489ef3288c97bfac2a2ac232a5491c51a1faf0ec8ea39f3ccd533","bytes":4434394}],
 ["public/belle/golf-center.glb",{"blob":"d71495bda23d33f93c95d14674a776b894893fc6","sha256":"924cdc27dac5c0918d31619ec2b98853d9db7eb4c2d388634321159bf31b4c0b","bytes":871580}],
 ["public/belle/historic-houses.glb",{"blob":"da6da051ae2d80d0701a856d57ff0668db698ed7","sha256":"261b12bd908d37472323adaf0ec5e760ed1c55103881f28b217496edf2a8305d","bytes":3323960}],
 ["public/belle/hoverbike/michigan-2084-bridge.png",{"blob":"d1a568013be2e61704dd15238143d534def67442","sha256":"6a7999d0364fe92fe4de2e30564fa4af68f8e8e244f6ea735111ae6ec40ce4ad","bytes":2161869}],
 ["public/belle/landmark-detail.bin",{"blob":"d78432520aca7cf6575461c1d8cc3c9738034bf1","sha256":"c0ce94cee9cac8e8ebc51e7348100aa619d9db1c4b3b668f47e2086598d60d79","bytes":814456}],
 ["public/belle/landmark-detail.json",{"blob":"7adff0e1595f2b15d5b3eaef8a7b7ca203cc1b8f","sha256":"5e38eb76ab3a9efc82c3c99170e2761bb99e33eed8bd3afeeb7ec3b1bbb3711f","bytes":7113}],
 ["public/belle/landmarks-delivery.glb",{"blob":"93005627ad82b806b6f0a8a57b01d3bf44b21f0c","sha256":"99bd8f7a8c1a5553bf78c0ab1e99cb771c275ca39fc6808c7fab07d8d899d3ba","bytes":30417032}],
 ["public/belle/landmarks.glb",{"blob":"8319c6e16be404ac8316754e4459d1f864532220","sha256":"560632f68f9f68974fef2f2f09f2e436f6742658ac864e35091e1c9a7c79e80f","bytes":59618460}],
 ["public/belle/map.json",{"blob":"e5c741279fe981b928c9fd4d58a72d72ae7cb017","sha256":"eb36e093fc477055c217025668403fc5d2c422bfdc9d9021769192dbb5660d87","bytes":988881}],
 ["public/belle/nature/LICENSES.md",{"blob":"e062b1773512d0177653155548f725ddac1a9b4b","sha256":"dc85d8364a219621b22d628b6fb3a31330f4167a063deb350e28bf33b09b9f67","bytes":1366}],
 ["public/belle/nature/birch-far.png",{"blob":"004291ab88b2b8b7b9e1809cf1ddaa4126989e16","sha256":"476db7cf6c8fa1d15eb776c7d5f18e5c51a1b8d71a382b75f8aa030f722e3290","bytes":289933}],
 ["public/belle/nature/cherry.glb",{"blob":"f7141115d20a6ec5c1e5b874b722f70c7c06c44e","sha256":"37f631efc2c575bfe8a7b12805a0bec8349b3b7770ac6b972a28c8b597e0dd4a","bytes":6725036}],
 ["public/belle/nature/gardens.json",{"blob":"60a87532de7c11a25f0f312507bf9329bc16c148","sha256":"83f271aefe991f5f883cfaf52bd11c40121fe20d3ed8f6c6ad79be8ee6985115","bytes":901104}],
 ["public/belle/nature/groundcover.glb",{"blob":"4ce62d29350c949a74e1f404b08ce5fd33e00254","sha256":"f040bc4e3498f0d89c0cb6cfbe806260c84061c2e0388f1a8d227000e1d30154","bytes":1876460}],
 ["public/belle/nature/heron.json",{"blob":"ef7d0a5086965f50678e627d43d97da9e53fc6be","sha256":"4a2012cc3fd294dbb316fa8d7f52862e1a8207129033027671b884403f036dca","bytes":139734}],
 ["public/belle/nature/manifest.json",{"blob":"3bcbc0e6f3eafe0ac7ed61527cb0f72fd1718d10","sha256":"618286cb9fb128cc312efe2549f3955e048ce3b4b1abba5f98a1f7ace0e5e4a8","bytes":3220}],
 ["public/belle/nature/maple-far.png",{"blob":"10204655109a91bbabe5ac463eca7eeafcd71275","sha256":"5203c03341603fabfc9b082cc8307c3223c8eb52ee5be398454575be0eb7efdd","bytes":352775}],
 ["public/belle/nature/meadow.json",{"blob":"b4aa16041ecda694c96d2aafe7a0fcc2f49df141","sha256":"67ed70a168b1e59dab7fdf40b822e46f8a2356f4eefb0edca7cf8a465c3cd183","bytes":3613546}],
 ["public/belle/nature/okonoka.json",{"blob":"9d4e8d4ce01af800dc869670f8fe86240cf8c245","sha256":"61810feb91f3f4d7078fe7f26e4782f027dcce6c8a6cd2908acf9510093f4bee","bytes":169790}],
 ["public/belle/nature/pine-far.png",{"blob":"4dd1b699fd1ad8113a84425d7803aec5cbe8db21","sha256":"499ab336a3db4034e373b0866213442677e04e6edb53f85c70b50e0680a7eba7","bytes":297193}],
 ["public/belle/nature/placements.json",{"blob":"bb3185d428998b28a678bf9b2c3e113f0c77668b","sha256":"00dfa32a912db9b9da502c4823d5857075573223fe6642acce9b9806e60c2966","bytes":1080179}],
 ["public/belle/nature/seasonal-trees.glb",{"blob":"d98532de4b3aa2c9f99a81fa8de1b33120129c6c","sha256":"7e573c0fa6e1002bc915faa388459d4f927743a09ef4947922b3e19d347e576a","bytes":5365968}],
 ["public/belle/nature/trees.glb",{"blob":"100bc45fea50800c8f0374f542a1201fb546fa03","sha256":"2a7ef60cad15f2eb8322bc307e8ad53549eac0e2864aa0dc2e53c0994e0074b4","bytes":4607016}],
 ["public/belle/nature/willow-far.png",{"blob":"712280148137857402ad1e0b34c0097c2d683085","sha256":"2a1a85c6378b6463cb551d93c424bd2f2db8808731cd76e7994f724fa915ed54","bytes":335945}],
 ["public/belle/pavement.bin",{"blob":"3995ebecf728f4c14d4c79d10bd43a6fe8f82571","sha256":"14d16dd1c3148c8ee6132c765e59934b9e86ea79f4607dfd48dd08455feac21b","bytes":1693664}],
 ["public/belle/pavement.json",{"blob":"ef9dd9397ed6cfdb1ecea0d2e4d4089885fe83db","sha256":"d087fb6e489bb0d3ab9233d229ec586832efe96bcfef8ceabd632b145c709de9","bytes":1263866}],
 ["public/belle/playgrounds.glb",{"blob":"8fb353cd0009fc229b831984227ddc9d04e2423b","sha256":"a0b4ee5d55876694e40658680a466fbc5ecea17899705ce2ef4cfccc10e360f2","bytes":3077524}],
 ["public/belle/race-checkpoint-detroit.png",{"blob":"756ff0f04f981d9773cf6bc4d1499b1a28a17fcf","sha256":"7877ac1988f1797046a3761fa39aedf422c9e8b311eda831a0d5f9bc9d223c54","bytes":1715769}],
 ["public/belle/reference-architecture.glb",{"blob":"edd939b6aa092baf9110603a315a048d7e9635f8","sha256":"486257a051be2076b04cc8e91181528200332810cd80dc8454e802a37bccca6a","bytes":1281660}],
 ["public/belle/skins/PROVENANCE.json",{"blob":"fd71980e6dd85f289f6daffb035f07dbbbfab272","sha256":"b542c6bc4eb420edffce055846dda956a9f6e2c5154292c2e8e3fdd8dcf15fcc","bytes":36076}],
 ["public/belle/skins/aquarium-jade.png",{"blob":"eb50fc014cc963e78f1532c9b275a7ae51510fbc","sha256":"0cd22b5a08b9c6502b5b2ecceae7ea7b7540d8bbe39bfdf35af5ce5bc9013665","bytes":1689164}],
 ["public/belle/skins/asphalt-color.webp",{"blob":"c6912e1541c394756ec81ab7763cc2aa07c6fdcf","sha256":"dd455673f52a123c881a553182c241e46c8586ff5d104391d7711ab483b3c171","bytes":334260}],
 ["public/belle/skins/asphalt-detail.webp",{"blob":"02b4d6751441e2a898ebf95686d5dd7d832b8dea","sha256":"1f550de87b7cbcb8cafd9e3efbb8cde6fc15319b289ddc6153bae6d5578c4f66","bytes":298930}],
 ["public/belle/skins/bark-color.webp",{"blob":"3952be40801414c1697b68cebc752e34bdc8ed5d","sha256":"7f28a38793a23fa092004ab4959effd191b6f74b402dfcd35d10c9b55e3fbca4","bytes":382704}],
 ["public/belle/skins/bark-detail.webp",{"blob":"4102b40c50f1b78095fc743f98f9c93f3da40982","sha256":"df66465631c2cfc1d69fccb0dc478ca250829b491362a813fdf54019c55d5223","bytes":312428}],
 ["public/belle/skins/brick-color.webp",{"blob":"28a0f87398dae053b27caf690ab1b77644e8854c","sha256":"90575259db2fe0217d00ad84c40a6c523e914a4933c498e3e6ad621a50b2629b","bytes":293134}],
 ["public/belle/skins/brick-detail.webp",{"blob":"137f81ec6637a163ffa29fd38fe76ca0960ae8d1","sha256":"99b34781744f04ef4fdec5baf29bafd386ae2f2decf49ea6358ddf5d93576d90","bytes":219512}],
 ["public/belle/skins/bronze-color.webp",{"blob":"aa9cbcee54f0a968713aec8887f8d2ecd0b5726a","sha256":"be42a82090780ab0e858ec85fbdefdab747adc53de44a0ad77b3b42ef362847f","bytes":107268}],
 ["public/belle/skins/bronze-detail.webp",{"blob":"84489a1937bada1182bb9f4bea2b4e80c2b37f5b","sha256":"1f6deea89be8a5bd787c3bdf04a945b57699712b9f8ad0c0dd97b88adfe826f7","bytes":243414}],
 ["public/belle/skins/ceramic-color.webp",{"blob":"95439924f26622307f15dd397d0f5e6bf8dcea75","sha256":"b459d4323638f9ef832c8fcfa06b413ca5202c953a563c06b53e58be2dc15d7e","bytes":35464}],
 ["public/belle/skins/ceramic-detail.webp",{"blob":"7fe1a8f8ce2b5f416837ae6bb0dc667f37a88e73","sha256":"b3007145f2f5d42c8d8f3dac3dc344655ffb525946e852f4653bb23c91a862de","bytes":201592}],
 ["public/belle/skins/cloth-color.webp",{"blob":"8d9d8d3fbbcb635e652cc15be17f44c22c0a5761","sha256":"dce39cde6e20261d092fcbd59024e42b8b250826edc56a09b2fcadd6eb9aa2c5","bytes":390032}],
 ["public/belle/skins/cloth-detail.webp",{"blob":"dd1e43335d1427f12dee482414aff2b581739166","sha256":"c89db78278ef294eae1382bc5de4a1b59aa27048b61ba0eb43bc68b0749fbf05","bytes":307548}],
 ["public/belle/skins/concrete-color.webp",{"blob":"e9b9b0e504a26159cf54eb89882d2744cecfb1e1","sha256":"98d145299af4054a61935ae958f37f7735ddca151a145cb2dbd220a40cc57982","bytes":220474}],
 ["public/belle/skins/concrete-detail.webp",{"blob":"b54c0476c87fc0ecbed379999ee9c29ac73fe57d","sha256":"3e097ac48c7e61466c1b6508990ae9cb4c5fd3af26b88a501f47cace402b6b8f","bytes":254782}],
 ["public/belle/skins/copper-color.webp",{"blob":"f3b2501a22918ec72666e5b0f3101f3ec4f5c730","sha256":"aba6b33d9554137c444e3f17901df399dd04f67c963c9536bacca5a0efb2ee52","bytes":279522}],
 ["public/belle/skins/copper-detail.webp",{"blob":"359afbd85dffc3c228e69e037ad872c2e65095ea","sha256":"79e17845254d19ea19da9d1b9b9a754ef30b6b5ef8f6d454d196e040bdf48837","bytes":256274}],
 ["public/belle/skins/cork-color.webp",{"blob":"c72e46942ead9d12ecf98e9fbf193706d539c071","sha256":"30c2024d9e65e8921bf3375a946aa605fe5ccffcaa701657385defb358923128","bytes":362616}],
 ["public/belle/skins/cork-detail.webp",{"blob":"825f6fb5ede4637476dd1e539ac05037bc57faa7","sha256":"8e440caa164ad37f60eade226dcfc8f9a6241df2126d029d0676aad13e832e8d","bytes":301608}],
 ["public/belle/skins/dog-replacement.jpg",{"blob":"05c915a8c24313036d3510a75b2e9da5a0958fa6","sha256":"e1d40390996c325158f3ebb7a92c86ba897797b1e32dfb634624223dbb935cb1","bytes":1519076}],
 ["public/belle/skins/feather-color.webp",{"blob":"9211ddfe8cb96d760495293bb2a6a4826a66258f","sha256":"828d7dd7196a81084ac9310eb7e20b2c7e9fc723dda59cfb99eae71d1b6dce8e","bytes":284030}],
 ["public/belle/skins/feather-detail.webp",{"blob":"044421edc157bd5fcc0ccddebc2b3bd340221254","sha256":"da504184c0da85a3370428ffe0b7537f6f39569e15c7a8a3929789c69ff0cefc","bytes":245188}],
 ["public/belle/skins/fur-color.webp",{"blob":"3b85288767ce95ec95b7bb7744f21b3596aedf2c","sha256":"b8923ebe0deb08d8db573d1761f1ab0b1b551ddd92e50f89825d329f27b69c7a","bytes":365306}],
 ["public/belle/skins/fur-detail.webp",{"blob":"525d983ff012cfab919ad7607e36b43cbe919417","sha256":"57d6c9569eee3472a6273c99c1636cf477737eefbd27c13a6cdbc7c83c5f7efd","bytes":313144}],
 ["public/belle/skins/granite-color.webp",{"blob":"edd6a14a376b00ef99baad1aeacb13d4da34a16f","sha256":"c1122e1e025af9e41ba00549fbc390840ebf8313b81126d74dfdb8c2aaafff6e","bytes":350988}],
 ["public/belle/skins/granite-detail.webp",{"blob":"5e91a7c2b4d3205a85a5b402bfd305602781d127","sha256":"07c533cf4293ea7a5fe61a550498b1bb71145ccd519feb0e44edfd20125a1416","bytes":231068}],
 ["public/belle/skins/graphite-color.webp",{"blob":"316c24e1907328f50b3a80c967a4e3799f18413a","sha256":"581cef68e21cc9a6b7d9944ac5aa78b86a74f35e10be18ee93502c0f579a61e4","bytes":93592}],
 ["public/belle/skins/graphite-detail.webp",{"blob":"69f8a729ccfdf2a74fc831f0dc13f7417b28f494","sha256":"e148956fdbcd3eee923f1e79cb5ee265ad6cba1880109b24b02ca28991845227","bytes":230610}],
 ["public/belle/skins/grass-color.webp",{"blob":"6c26039e1183191953425fed67edf007402901c1","sha256":"95d1a99861eea7e55f60df8f7c59a09b3eac10df890ce1759b4f02fdd8389e7b","bytes":459994}],
 ["public/belle/skins/grass-detail.webp",{"blob":"005d48ee233d6f16833c8ee7186dddf7fdfa46ce","sha256":"c17f136680b21e091bef70cce4549f0b1d0c009319df924ee0cc2082c2c4fd82","bytes":312280}],
 ["public/belle/skins/gravel-color.webp",{"blob":"9534b3fd0db8a8237844182382fc3b6efb28e119","sha256":"18d4071626c8c54510b608be2bbe788522c3bd938eb919e7013ffcb479a909d6","bytes":506278}],
 ["public/belle/skins/gravel-detail.webp",{"blob":"6a5b7a178ff4697fc3645aa002ceb097e5ac598d","sha256":"478b4ed6eafbf4a23af22c634d4c5e5117513b49ee024d60887278af762237b4","bytes":239538}],
 ["public/belle/skins/leaf-color.webp",{"blob":"df88678b36a00d0b1051fcc655d1b9b479eecc63","sha256":"dcc8d88b846996f6eef36f183b5273ba462d2dfa59586abfd7ff58f0c51d0eff","bytes":315414}],
 ["public/belle/skins/leaf-detail.webp",{"blob":"426ff75108521812187522610c1618bed3a6c554","sha256":"94ba8b43613ec5607e85d756c4018efc5da5dede92f01fb1e4042f6df32ceff3","bytes":299190}],
 ["public/belle/skins/leather-color.webp",{"blob":"46e45cd3c2897c60f58dc0750ce12660b1d7b27b","sha256":"df48d5b9d68307e8fa1a6ccc6778960835e05fddf2c04409a7f81b20673744f1","bytes":103574}],
 ["public/belle/skins/leather-detail.webp",{"blob":"1c018d9c11f9526ece07542668ae00ca79e66f5a","sha256":"20a2279ccca30ecea96bafd975d8f4277bdfad6cbbfdc49f6824bf7dc85da31c","bytes":254400}],
 ["public/belle/skins/limestone-color.webp",{"blob":"24e1485029071e11d1e11be7928b39b4d7eb0623","sha256":"15069b349f557ab7c9f7cb40d8e44bc10391f847f8ce1a36e479ab7cdd020043","bytes":222314}],
 ["public/belle/skins/limestone-detail.webp",{"blob":"04990d486c1ac5cc4169881b6e60c358839a49e7","sha256":"36939611b5bd7133e995000943e8052a075fe3724a3a744c9de520fdebd9a55a","bytes":255448}],
 ["public/belle/skins/marble-color.webp",{"blob":"183ec2d849e977470331efac7e431182e56d14f2","sha256":"5e4d2e22dec195f9bcd7cfe2b5985a9b3cd79269b0c7404bc6a762dbb24801c5","bytes":33734}],
 ["public/belle/skins/marble-detail.webp",{"blob":"f8b12bc9e4ebd780071495b53cb39587f917f791","sha256":"bc4e1b44a47d2bf015a137cb0080c6b4ec5f761ba842d8b1691975551a1915de","bytes":213538}],
 ["public/belle/skins/metal-color.webp",{"blob":"5f00d58c1b752a57f9f8fe90ab7b49d6c8d63332","sha256":"ab600a85288ebc8174ea35c08499d81d64c0cadcf4b3550c7157b53196832218","bytes":86732}],
 ["public/belle/skins/metal-detail.webp",{"blob":"b0c0811342ceeab911526529169ebb71345c76ba","sha256":"f2a10a13998faef414f028d3c8c90897c2de52dab5034c11351d82a1ca424f63","bytes":209384}],
 ["public/belle/skins/paint-color.webp",{"blob":"97edfaecb22f908963755a85974588c03abb973b","sha256":"509382cceb3470ea074cf16997196c0cc9cd123f101676a02d242ac3f9792d48","bytes":50898}],
 ["public/belle/skins/paint-detail.webp",{"blob":"4c25e401f56073387898036b69422378fcd762a0","sha256":"3665a017e7707ffe15591a146ef6a9a539ed62b1c1fa5c6aa1519de77df1f30a","bytes":199178}],
 ["public/belle/skins/roof-color.webp",{"blob":"4cc683a98c1fd48325ca35f7eebc056155d86c8c","sha256":"1f1b5f3fc2e986c3d6213e6c12131f7ab17604785b4639f74c1c78821a585f75","bytes":141928}],
 ["public/belle/skins/roof-detail.webp",{"blob":"6484496f4987689ad25b2115d2d103e591215b22","sha256":"4f3922ffbb848e2f260d6c65396890013d8f66d2c2fa5be23715b76dd0ea90ef","bytes":217088}],
 ["public/belle/skins/rope-color.webp",{"blob":"04f9c8e0e093dea6fd3ee106de0d8219f57af245","sha256":"903c5a9d9d2fa62c8bc08a2dbe0768ed4d0713206787875acada0eb11b1bc44e","bytes":396962}],
 ["public/belle/skins/rope-detail.webp",{"blob":"3d727b426f2884ed8298e2716e010a626c1739d4","sha256":"ade1a0b46d0aa8eb4fd38dd1f94257ea827fa217ce2defd706730cf2f6e6f48a","bytes":233118}],
 ["public/belle/skins/rubber-color.webp",{"blob":"fa3106341dfd28af6cac58a3c09d78666d507218","sha256":"6d9ff00c7db07f7f559d14abd176e5a62e706f22ee90ced5985b85b6b923b3f8","bytes":150690}],
 ["public/belle/skins/rubber-detail.webp",{"blob":"40347bd25e9f5ed4bf7d1f8746a5245bf8bdc035","sha256":"935d464afd1ff54f79106cade3090b2fdc5abd91d93aaffbcb5c204f5f223171","bytes":311722}],
 ["public/belle/skins/sand-color.webp",{"blob":"bf274adb40fbc84fcc5371f219bbd22815767fbb","sha256":"ca589561ae72eaf775675411e78053c668a2922722ab4ec4b8450756aa807e65","bytes":315726}],
 ["public/belle/skins/sand-detail.webp",{"blob":"c0aa9ed9f9e5a25d595b9a03c424b76207e052b0","sha256":"f3a41966a9eb65e313becb08f661aa37360a1db2f59d15ffb611cb8aad23bee2","bytes":259400}],
 ["public/belle/skins/scales-color.webp",{"blob":"933c214518c90c631e291a1ec62241d71e5cf123","sha256":"dcd5369046569e62784b5a58435aefcd77faf6f69852535d98ed092470daa16a","bytes":273876}],
 ["public/belle/skins/scales-detail.webp",{"blob":"d0b9e3b7b9cbd36cbbc8474e2a58b2715821861f","sha256":"d754fe91dae75474a9b390ac5a0475bd4dfd12643f5f93e31428a0b68f0bb1f1","bytes":224090}],
 ["public/belle/skins/skin-color.webp",{"blob":"37b4e9a5b5a97086c9f15ee310dd7cf8b7a04d69","sha256":"30354e2db7e14bc58864348a4bae5677f6c1675d5d4d864dc8dd99f95ac3cacf","bytes":49680}],
 ["public/belle/skins/skin-detail.webp",{"blob":"2c8a14c9669dc7da2dcd024e49d707893de0efd5","sha256":"d9880e2f3a5bdb053ce17d0ada402fd53348b87dcd48bf42141769c1e97aea54","bytes":213784}],
 ["public/belle/skins/water-normal.webp",{"blob":"5b3fa4f9b99440ff7d313dcfc4f6694e74702fd0","sha256":"62574c8e014ccfa92c85cfd4a48a50921adac515998dd4dea71a3ddf6683bf6c","bytes":293734}],
 ["public/belle/skins/wood-color.webp",{"blob":"8d3f8eb061e4f1073f4ca2bd3c149c315903cdb7","sha256":"101c1d46f0348da1553820014f7564a38e3daa082e259910a1a00c4504836a64","bytes":263138}],
 ["public/belle/skins/wood-detail.webp",{"blob":"e2e72114c19ecaec9377ac23270a8fcd5fc789e3","sha256":"ffd9c4d599bece04fbbb6598409778dae105d415c7cfec874d44c365a9c19d33","bytes":312538}],
 ["public/belle/startup/detroit-embroidery.webp",{"blob":"a297dc2310df06d6e024aac305feddaf8cd4af6f","sha256":"fe072959a02c3d9fde5e485c9ee8e283328779fcf66b67eab4b6aecda6e4fa63","bytes":351778}],
 ["public/belle/street-details.bin",{"blob":"a1479dcfeb3bf7c314514dd3283c3f5b215af46d","sha256":"9660caa782604b0a9e1b4f472208532c2597563ed9e5794801e645a0b4e1fc1b","bytes":1657224}],
 ["public/belle/street-details.json",{"blob":"343a003964102ab73e7caa413c5cc0650d70924f","sha256":"ed32042a8546f5ade94af3eb475bd3e5ea452c034ebdca17bd24c23b2b9edd25","bytes":24233}],
 ["public/belle/textures/BEACH_LICENSE.md",{"blob":"1a5e362ce4c02b2fc0bb7a72f66ff5da575285c9","sha256":"81b17fa6bb916e25af8ae5e172c4c213e5dd4ae6c2c834db5978f6480d8452dc","bytes":318}],
 ["public/belle/textures/asphalt_Albedo.png",{"blob":"93d38ea8ce6aa0230942b82e59a582add725398b","sha256":"c821a0740cc009ffba9a4e1b76a2202d387a5a1a6b2270db3c90dbb122307115","bytes":2522241}],
 ["public/belle/textures/asphalt_Normal.png",{"blob":"e99abe280f613b17d4f0ceff7db888cba13cb83d","sha256":"0f65376fe7d76c2008e767c03dab269384e8a2f41b46c9b0962a2e8776cd2a8b","bytes":2411325}],
 ["public/belle/textures/beach-sand-albedo.jpg",{"blob":"7c7a662b8302f86f74dff88bafe9f3d9f773c781","sha256":"6854bc49936d7b2971b579095c21342ad2c8fd1495aa3382b840335202964f53","bytes":923953}],
 ["public/belle/textures/beach-sand-normal.jpg",{"blob":"65ceb7ad737cbedb4a9c2cea40d80acfc4430c21","sha256":"285a9b5c7f39215a1446c51a69d81228a01277ebafc48b9aeebd115066b4f796","bytes":1113299}],
 ["public/belle/textures/beach-sand-roughness.jpg",{"blob":"a01fcf7802b3657d257255a9504ece5a8683893c","sha256":"f2b99b9f81c7bd467107f61551ab6517cfa090efcdb10cc19bc2fc4ea347fd7f","bytes":479959}],
 ["public/belle/textures/grass_Albedo.png",{"blob":"accff9a51e7abe285d9fbd8bfc5b50675418f44a","sha256":"40891a51094b0cf1913ea6532f9869d5bd5d6216edd14802b09aed6ef814d7dd","bytes":2389996}],
 ["public/belle/textures/grass_Normal.png",{"blob":"58c2c3eff26023f89f8e91b322afd2885b90134f","sha256":"7e94fd7a8b7d81a8a2a5717f844ef52b36383cc6aeee1c93d7e487e3a1a01eb1","bytes":2673316}],
 ["public/belle/vehicles/audio/airbrake.wav",{"blob":"f67cae43e1cb14f3b6e58379671eaf288b6b3f0a","sha256":"4e11e2cb7c94f5934f7c5074fc9d5452b719acc454404ab952d71febff5a1406","bytes":97044}],
 ["public/belle/vehicles/audio/hazard-warning.wav",{"blob":"6bff047ed6d8ed3c358edfab1d1abca9b88ecbc3","sha256":"1e0cc67a26accea8d34bbac2b9a9f93dd19bb2c9a050e61ad76bf08042814da7","bytes":141128}],
 ["public/belle/vehicles/audio/impact-warning.wav",{"blob":"d21fab51e23b5a439b26a7aaa6110289979720ca","sha256":"5ff42cf89aaf0bfc8dc0111050e1dbc9c89d47fcf03f06d5c6fbe97eaaf3c5d7","bytes":144876}],
 ["public/belle/vehicles/audio/landing.wav",{"blob":"fc8fb0bb8326604cef0c9b9771df2bbea017467e","sha256":"04cbaf4f7a4b80be21850fc7fdcf410832534e3f01adc989fcd11a2fca1939b2","bytes":144970}],
 ["public/belle/vehicles/audio/rotor-loop.wav",{"blob":"9d5f016bd7e300f4b39652d655861564bd4948d0","sha256":"fd7bf9331d1374e2c9ff0001d98be25499f7961b1c43571d03845e70872a6d8d","bytes":324566}],
 ["public/belle/vehicles/audio/takeoff.wav",{"blob":"5ce382ec08aec31f9309655b193f59c4ac3b6dc7","sha256":"9930fb2414d1158d8004f2e7aa5fff1ff1743b4518f9feadb517d0f7f59887a9","bytes":192896}],
 ["public/belle/vehicles/authored-packages.json",{"blob":"0ac78a853061e16374e2b5bc6d4b6538c22ed9e3","sha256":"67cbfbfb04e80234590805ad8588e47df76b242b91574f4eabc8b06799fac729","bytes":2516}],
 ["public/belle/vehicles/boat-provenance.json",{"blob":"02b61c5f19266dc1aac96e29f9a974a1308267a3","sha256":"03ac1ba46bc6967b06ba4579568f5e59d8587f2120a5137fac7368bc96812ba3","bytes":2567}],
 ["public/belle/vehicles/corleo-maverick.glb",{"blob":"87d67d41faf5172de0e5185bb1f76734a11680e4","sha256":"eb1e40edbacd44053ae6ede7a53e91c0b0682bb12fc240b97af5aa14b79d0c49","bytes":3851164}],
 ["public/belle/vehicles/corleo-professional.glb",{"blob":"96e8d0c84a13c12d2437d300593c20d3423c5026","sha256":"eb403561533a708ae203d3d4b668519b7dd4eec6c9adbc4e347613b87de52dd7","bytes":3924176}],
 ["public/belle/vehicles/corleo/CORLEO_Maverick_CRAWL.glb",{"blob":"d248e528c8df936442adc9ea74d068fd3c78c82c","sha256":"681066e19a963ba317176b1482d3335f3ab46e112d610f343e287ccf9ab46a21","bytes":3145044}],
 ["public/belle/vehicles/corleo/CORLEO_Maverick_CRAWL.glb.gz",{"blob":"b485c84cefaf2d4eec7fd4d516230705ce93e0cd","sha256":"5f605fd7930c7ee9409231e1957c0a72aa7cda346adfd8e2757bde7354d93b56","bytes":627657}],
 ["public/belle/vehicles/corleo/CORLEO_Maverick_DISMOUNT.glb",{"blob":"00d9f20b0534ad6374fef4a01a031b76b9a1cf8e","sha256":"583393697f987da01c320a057f28b5d73481c55ee7bccd0335019bfba9ceddd9","bytes":3391048}],
 ["public/belle/vehicles/corleo/CORLEO_Maverick_DISMOUNT.glb.gz",{"blob":"30fedfb1936a5c3e5a5635afe7fbe88df8caf971","sha256":"0624eb5dd5d74990b815622a7a00f2ee49677a2ae627859cec3cec9f4eac7778","bytes":688364}],
 ["public/belle/vehicles/corleo/CORLEO_Maverick_JUMP.glb",{"blob":"8b36b31cac9174717d50f142d810a63c7eb8be3c","sha256":"07ea775395c894c93cec4cba2186058bc1cde8764aca7930fe1b6cae4b4e849b","bytes":3174196}],
 ["public/belle/vehicles/corleo/CORLEO_Maverick_JUMP.glb.gz",{"blob":"41fd2fba065c357f605b3df03e71e3734355fd1d","sha256":"634a976c0586e3b2e0444ec59ea3adc486bf2c1e01bcd6c296a3e7e17dfa4127","bytes":626881}],
 ["public/belle/vehicles/corleo/CORLEO_Maverick_MOUNT.glb",{"blob":"77abb1e6defdb7f05f70181d88609b51b5c2ef92","sha256":"43e4c6d4981491cd189a5a698048381fb0e22e9ba7ee7cca4704ba643ac81c10","bytes":3391044}],
 ["public/belle/vehicles/corleo/CORLEO_Maverick_MOUNT.glb.gz",{"blob":"69f3dec4fd9a0611368d8b9f94314dd0d2761393","sha256":"a0009d636a11db6280931fdcde63b7ff56f9faa4e27ee711e997582ccc725308","bytes":684923}],
 ["public/belle/vehicles/corleo/CORLEO_Maverick_RUN.glb",{"blob":"e64b0cc7d977b74ff455820d9b5de48537de2520","sha256":"942d1f1966d955291dc70bf79754982fa2327fba2c64034d0320ee336f1342d2","bytes":3167160}],
 ["public/belle/vehicles/corleo/CORLEO_Maverick_RUN.glb.gz",{"blob":"734c2da7259ba5ea010de0bf97a5a8cd72bb0edf","sha256":"72668bb83ca50caea8a6132198a417a05eced209c28692b3344a76e7117148c1","bytes":625134}],
 ["public/belle/vehicles/corleo/CORLEO_Professional_CRAWL.glb",{"blob":"e3a529265211baddc282321fbd9aed9278e2a25b","sha256":"72aee08c93abf465ab46eb5194b554c902fb09e4a511699ea45026d6461c9e81","bytes":3218036}],
 ["public/belle/vehicles/corleo/CORLEO_Professional_CRAWL.glb.gz",{"blob":"7f13fa171ce1970ec9da1e0f612873196d8a408a","sha256":"2b865928c604966a494b939672d82e340be151451794c9e63e42db14bceb9d55","bytes":638461}],
 ["public/belle/vehicles/corleo/CORLEO_Professional_DISMOUNT.glb",{"blob":"378606a611beba1969c8f880c81e677a94e88ad0","sha256":"16b5dc4faf245e1f8a3fab7273ac32b44a7c8afd218d520492e4e0e0aa6ef9b7","bytes":3464040}],
 ["public/belle/vehicles/corleo/CORLEO_Professional_DISMOUNT.glb.gz",{"blob":"a32eceef391c4c2927ad2f1bd68e9e5924577328","sha256":"47c95e706978a54d00e16657083831eaabd46048787eb7a9229a44b91d66224f","bytes":698418}],
 ["public/belle/vehicles/corleo/CORLEO_Professional_JUMP.glb",{"blob":"39b9f6a9697e2c32a836980018dc43fced75e729","sha256":"b0cc9bb69541c467d2a7c23cd8dfab87eca483cee2a8aef5763b9a1281f739f6","bytes":3247184}],
 ["public/belle/vehicles/corleo/CORLEO_Professional_JUMP.glb.gz",{"blob":"fbe93ba5fc8e218aea7663741ed668056af0f16e","sha256":"af64fc932e114cc121f72d837b1280ae848cefc236638db253bf68ecf0c5ef28","bytes":637787}],
 ["public/belle/vehicles/corleo/CORLEO_Professional_MOUNT.glb",{"blob":"dd8d18922e90f4003559307ab7a87e13b2f2403c","sha256":"8f8e1802fe26bf3b694fa15f7cc2ea23300c5a84411995b0d960ad0f5d116db3","bytes":3464036}],
 ["public/belle/vehicles/corleo/CORLEO_Professional_MOUNT.glb.gz",{"blob":"08fcd38d11c00eff618da85d0e6c5798fa81684d","sha256":"0523bb76d8254bf99e55c1669af695b4e9bf445047f3adbc04cae9ccb7f5ae0d","bytes":694743}],
 ["public/belle/vehicles/corleo/CORLEO_Professional_RUN.glb",{"blob":"885bff15641cccdf551569d4a4e70f57909e3dd0","sha256":"2eb8709ff018d68ce75d04d57c40234a02b095d43239ffb7c444b71564de5f55","bytes":3240152}],
 ["public/belle/vehicles/corleo/CORLEO_Professional_RUN.glb.gz",{"blob":"20342117eec45f87178300a76fb59a51c3c35ecf","sha256":"fad3ce663e743df2718d6ad4239413f7f82c8ac116195cb2cc2a5bbd1d5252d6","bytes":636122}],
 ["public/belle/vehicles/corleo/manifest.json",{"blob":"a1776776db934d679a85d4aa91c80861db5313cb","sha256":"3d554461098394f0838eb0f84cfa20753add7b2410cfb64e471bef7b3b6d1e29","bytes":4421}],
 ["public/belle/vehicles/hero-hoverbike.glb",{"blob":"ecf91d030fcc414669bd91f3ff7b7bb4d90c4657","sha256":"b32cd287c12410163d528f606c668a8fd3e4ba779194b8c74d90228886ba4ba7","bytes":8754060}],
 ["public/belle/vehicles/hydraulics-cadillac-credits.txt",{"blob":"930ed84f7b0df0f9aef68daca4b770fac134a4de","sha256":"cf7a7c377736fa8ef26ac51eb2b64c66890e71367588adfee00ad796ea0af393","bytes":599}],
 ["public/belle/vehicles/hydraulics-cadillac.glb",{"blob":"10f3470ca378342ee2d33afa04df4315a0d6394b","sha256":"979ec7133647b49100a639344b49dc2ffeb4d8f9cd275cbe7fccd0e1b94f11f3","bytes":7529936}],
 ["public/belle/vehicles/hydroplane.glb",{"blob":"466c6a99d3bf12f5119eafdadb309fc61caba4e7","sha256":"e4127d1ded87fd8f0c9bbb29839f2ffb8f3488e01fb9c2804a552de957389b48","bytes":635916}],
 ["public/belle/vehicles/jetson-one.glb",{"blob":"44ad64f65918de1e3a68bea2d60d7bc49c706a05","sha256":"ff1430525309ce62224c765d755bd77907df78bb9ea2207501ace7d17f7063af","bytes":3959972}],
 ["public/belle/vehicles/pilot-maverick.glb",{"blob":"0f6143b40152a3f64b3796ac5c00bb17b43ce01a","sha256":"48a260626075859ee44de93f3b1beaf42dad62627ebda479d6cbc7356c180c6e","bytes":987900}],
 ["public/belle/vehicles/pilot-professional.glb",{"blob":"54bbda6407349b13da7afcb3484138553d0a47d2","sha256":"679c53bacd02a366dcd011eb634bbb13fac97535eca455a1762c94e4465bfd37","bytes":1059404}],
 ["public/belle/vehicles/silver-cadillac-credits.txt",{"blob":"6f632c20b5dd0f34d237e497b74abfc85dcca6af","sha256":"916be861eb76772e89dbeadbc2474b9a832b58ab0e919eddfd52e5a6e06ed135","bytes":491}],
 ["public/belle/vehicles/silver-cadillac.glb",{"blob":"dfa6289500ef94a4b21601f470a1a3f8fe441f42","sha256":"1fdb7b8c20bf3231dc76a8f8ade39f39c1aa83174534985c82c5b012ba4a6681","bytes":1582664}],
 ["public/belle/vehicles/speedboat.glb",{"blob":"2d11c9d31ee6c892b9775fe83023474662aae23c","sha256":"90eff0488bc92f932c5738e0a54207a4798fcbde29a2f8c6b0ceabdb10f9c36c","bytes":497864}],
 ["public/belle/waterfront-detail.glb",{"blob":"bb936f659e2f04e9924ce823263f639d53cfe47d","sha256":"7d2f69c2a121247643d4b67e0f21c301120ce39add37b1d178f0365a646a0e31","bytes":7587884}],
 ["public/belle/waterfront-lamps.json",{"blob":"46598eeac64c5be67c3ec6c782e1d47add3383fd","sha256":"f25497d9ef7956a5f2c52e0f77c0c4558bd1b69b223996d447a49c345b772710","bytes":5168}],
 ["public/belle/yacht-club.glb",{"blob":"b7d5982bc36271f99d80693bef8ec9965073d3f5","sha256":"47ddd0f03c1ed24fd2abb55e01cff4b43efd8fb35775d846b6c1bd5d320a1f12","bytes":8144556}],
 ["public/deployment-health.html",{"blob":"ffb5093eec62746e257df53f082b750f6f0983f5","sha256":"df9af224652c103d42947e67b83b5aa8c5ce45e26e000bab205a57e889cac2bd","bytes":3444}],
 ["public/deployment-health.mjs",{"blob":"34f467e0a292583580a6078470c04b653f1e7b58","sha256":"c7687f91e21110ccf15daef99529ffee406befdc7aaa35b8a0b8d58b6fabc586","bytes":3410}],
 ["public/exports/glb/DS_Boerboel_01/DS_Boerboel_Elmwood.glb",{"blob":"7e970778c6fb068a792b7baeb7a6acfff02a819a","sha256":"e80bceaaebc8b9db2ce7ca1765b74d8892ee6e7d1a31e41952bd21a0b64b39bc","bytes":1448792}],
 ["public/exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb",{"blob":"93a201e2783bd1ea3bca3594e3a35dff038ca87d","sha256":"ee06f55dcb5e1f5fab19851bafd0921434c258710461dced371ed3cc0ed5be9b","bytes":887520}],
 ["public/exports/rigged-heroes/DS_Armored_Rider_01.glb",{"blob":"1f895ae3ee41258aa5711691c43076010e5866e0","sha256":"b213894836ccc70eae371ffef6fb6a41688537f08c59aed6ea93dfd96f491674","bytes":3086456}],
 ["public/favicon.svg",{"blob":"11bfe38db6e62cc28451ceb62d3eac63e0c753a7","sha256":"1ba03d4f87b8edd661cb450a4a2fc6b5ffee9cb685f0d2991cb49c121dbce7e1","bytes":294}],
 ["public/release-health-model.mjs",{"blob":"ade509dca9f55acb6eef620948099518e72d72b5","sha256":"6511c005937b84072becad1848617ec105d48ce1599494b06a276bbce7cca9e5","bytes":2955}],
 ["public/shared-textures/3f53b9a02c9f9c4727e83d60052bb34fc1db6fb7d373aab33a730e4311dfd217.png",{"blob":"89cf667076248fb3817dc4397720624143f1fa58","sha256":"3f53b9a02c9f9c4727e83d60052bb34fc1db6fb7d373aab33a730e4311dfd217","bytes":338907}],
 ["public/shared-textures/8768259e02158e359806157505f6f576a3b941ed08ba25e4eb8897d55da4c6b1.jpg",{"blob":"fb95a018cb2a6b40ef15c443beb22184559ac33d","sha256":"8768259e02158e359806157505f6f576a3b941ed08ba25e4eb8897d55da4c6b1","bytes":2738531}],
 ["public/shared-textures/9fa142ce92c041fa2b10f18e963b09431b412c44d2fc18d3a116365b3bea070e.png",{"blob":"4967200979f2587a2a25664470898c361507adbb","sha256":"9fa142ce92c041fa2b10f18e963b09431b412c44d2fc18d3a116365b3bea070e","bytes":350166}],
 ["public/shared-textures/a843f85fb7e17825aa8e075e25d27072d68d203c27bd18b5014927bc1d1f75ce.jpg",{"blob":"6516a84afb561f205c98ec7ae3dcdd822bea967c","sha256":"a843f85fb7e17825aa8e075e25d27072d68d203c27bd18b5014927bc1d1f75ce","bytes":1013113}],
 ["public/shared-textures/b304d9fc61f24a03fc60fd4c93a9c68a073d6fb5b574ee1d166b097deac42b8c.jpg",{"blob":"672bbec534ba6516f0291a483abe20a6641598d1","sha256":"b304d9fc61f24a03fc60fd4c93a9c68a073d6fb5b574ee1d166b097deac42b8c","bytes":66617}],
 ["public/shared-textures/f9f5447a2bba37be279f4c413c296879e883f88cf86f2c79c9aaffe87df710a3.jpg",{"blob":"0b4ed0aa55b134bd493e53b651dab2d7776b38bc","sha256":"f9f5447a2bba37be279f4c413c296879e883f88cf86f2c79c9aaffe87df710a3","bytes":1923791}],
 ["src/belle/districtModels/detroit-scenery.glb",{"blob":"c0c5317b82d0ebdfc688b9975eb986aeaf5f0f59","sha256":"45b909a248ab197d1cfe39136fc73abf31fa1133611f718f2a5606ee16f0e1a8","bytes":350932}],
 ["src/belle/districtModels/elmwood-chapel.glb",{"blob":"7a4a70e4f8557d132ba9ed4ab2dd611efa015a54","sha256":"d6ec9fe8c3d806d0e7771cf9de352131d4642a8fe83138e68e10ca8ceee0f006","bytes":4535132}],
 ["src/belle/districtModels/elmwood-entrance-sign.glb",{"blob":"4b80f86501a7c84bf4dc7e1d9232799e8fb84441","sha256":"071d811091a3e8b14f9266939664502b0683dd93e3663f731d1744ab463cba34","bytes":506588}],
 ["src/belle/districtModels/elmwood-gatehouse.glb",{"blob":"ab15dd35fbe96f31d9b8f0dd07347ccef779b6d4","sha256":"6e365f69ba951e090c3f3950aa823ce1b1f4d1729a6d66aca911833135043b65","bytes":3128364}],
 ["src/belle/districtModels/street-at-sunset.glb",{"blob":"50e8beafbc0036f7be7f44ed4653ab755f713d3b","sha256":"217fa0a4a077dd554e1992d3196997de6f189c8e40e0bdd067d27c83b87afa92","bytes":1151336}],
 ["src/belle/districtModels/woodland.webp",{"blob":"86fedf4e8d2f28e28ceb69fad3b9323850965008","sha256":"6067e780229da91a9894fe15436e4ee758a182470374c4477994cab8b45a8432","bytes":215470}]
].map(([path,pin])=>[GAME+'/'+path,pin]));
const DETAIL_NAMES=Object.keys(ASSET_PINS).filter(path=>path.endsWith('-detail.webp')).map(path=>path.split('/').at(-1)).sort();
const REQUIRED_ASSETS=[GAME+'/public/belle/map.json',...DETAIL_NAMES.flatMap(name=>[name,name.replace('-detail.','-color.')]).concat('water-normal.webp').map(name=>GAME+'/public/belle/skins/'+name),...['street-at-sunset','detroit-scenery'].map(name=>GAME+'/src/belle/districtModels/'+name+'.glb')];
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashPattern=/^[a-f0-9]{64}$/,blobPattern=/^[a-f0-9]{40}$/;
const canonicalHash=value=>sha256(JSON.stringify(value));
const safeName=name=>assert(typeof name==='string'&&/^[a-z0-9][a-z0-9._-]{0,220}$/.test(name),'Unsafe evidence name');
const integer=(n,label,min=0)=>assert(Number.isSafeInteger(n)&&n>=min,label+' must be an integer >= '+min);
const finite=(n,label)=>assert(typeof n==='number'&&Number.isFinite(n),label+' must be finite');
function exactNames(actual,expected,label){assert.deepEqual([...actual].sort(),[...expected].sort(),label);assert.equal(new Set(actual).size,actual.length,label+' duplicate');}
function pixelDiff(a,b){assert.equal(a.length,b.length);let changedPixels=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<4;c++){const d=Math.abs(a[i+c]-b[i+c]);changed ||= d!==0;maxChannelDelta=Math.max(maxChannelDelta,d);}if(changed)changedPixels++;}return {changedPixels,maxChannelDelta};}
function noErrors(value,label){assert(Array.isArray(value),label+' missing');assert.deepEqual(value,[],label);}
function sourcePath(path){assert(typeof path==='string'&&path.startsWith(SOURCE_ROOT)&&!path.includes('\\')&&!path.includes('\0')&&!path.split('/').includes('..'),'Unsafe source path');}
export function auditShadowLightStates(states,frame){
 assert(Array.isArray(states)&&states.length>0,'Actual shadow-light state missing');const ids=new Set();
 const keys=['lightId','lightUuid','type','visible','castShadow','layers','lightIntensity','lightColor','shadowIntensity','shadowCameraId','autoUpdate','needsUpdate','bias','normalBias','radius','mapSize','map'];
 for(const row of states){
  exactNames(Object.keys(row),keys,'Shadow-light state fields');integer(row.lightId,'Shadow light ID');assert(!ids.has(row.lightId),'Duplicate shadow light ID');ids.add(row.lightId);integer(row.shadowCameraId,'Shadow camera ID');integer(row.layers,'Shadow light layers');
  for(const key of ['lightUuid','type'])assert(typeof row[key]==='string'&&row[key].length>0,'Shadow light '+key);
  assert.equal(row.castShadow,true,'Shadow caster membership changed');for(const key of ['visible','autoUpdate','needsUpdate'])assert.equal(typeof row[key],'boolean','Shadow light '+key);
  for(const key of ['lightIntensity','shadowIntensity','bias','normalBias','radius'])finite(row[key],'Shadow light '+key);assert(row.shadowIntensity>=0&&row.shadowIntensity<=1,'Shadow intensity outside original range');
  assert(Array.isArray(row.lightColor)&&row.lightColor.length===3);row.lightColor.forEach(value=>finite(value,'Light color'));
  assert(Array.isArray(row.mapSize)&&row.mapSize.length===2);row.mapSize.forEach(value=>integer(value,'Shadow map size',1));
  if(row.map!==null){exactNames(Object.keys(row.map),['textureUuid','depthTextureUuid','width','height'],'Shadow map identity fields');assert(typeof row.map.textureUuid==='string'&&row.map.textureUuid.length>0);assert(row.map.depthTextureUuid===null||typeof row.map.depthTextureUuid==='string'&&row.map.depthTextureUuid.length>0);integer(row.map.width,'Shadow map width',1);integer(row.map.height,'Shadow map height',1);}
 }
 if(frame){
  assert(Array.isArray(frame.shadowTargets));assert.deepEqual(frame.shadowTargets.map(({lightId,textureUuid,width,height})=>({lightId,textureUuid,width,height})),states.filter(row=>row.map!==null).map(row=>({lightId:row.lightId,textureUuid:row.map.textureUuid,width:row.map.width,height:row.map.height})),'Shadow-light receipt does not describe retained targets');
  assert(Array.isArray(frame.matrixObjects));for(const row of states){assert(frame.matrixObjects.some(object=>object.id===row.lightId),'Shadow light missing from actual matrix graph');assert(frame.matrixObjects.some(object=>object.id===row.shadowCameraId),'Shadow camera missing from actual matrix graph');}
 }
 return states;
}
/** The control changes only LightShadow.intensity. It must retain every
 * original noncolor byte/identity; absence of shadow draws is a failure. */
export function auditShadowContributionControl(original,off,restored,control,readRaw){
 assert(control&&typeof control==='object','Shadow intensity control receipt missing');exactNames(Object.keys(control),['schema','method','before','disabled','afterCapture','restored'],'Shadow control receipt fields');
 assert.equal(control.schema,'belle-shadow-intensity-control-v1');assert.equal(control.method,'LightShadow.intensity=0');
 for(const frame of [original,off,restored])auditShadowLightStates(frame.shadowLights,frame);
 for(const key of ['before','disabled','afterCapture','restored'])auditShadowLightStates(control[key]);
 assert(control.before.some(row=>row.shadowIntensity>0&&row.map!==null),'No positive mapped shadow contribution in original control');
 const disabled=control.before.map(row=>({...row,shadowIntensity:0}));
 assert.deepEqual(control.before,original.shadowLights,'Shadow control did not start from original lights');assert.deepEqual(control.disabled,disabled,'Shadow control changed unrelated light state');assert.deepEqual(control.afterCapture,disabled,'Shadow control did not hold intensity zero');assert.deepEqual(off.shadowLights,disabled,'Off frame did not capture intensity zero');assert.deepEqual(control.restored,control.before,'Shadow control did not restore exact intensities');assert.deepEqual(restored.shadowLights,control.before,'Restored frame changed original shadow-light state');
 for(const key of ['calls','triangles','draws','poolDelta','matrixObjects','matrixSha256','geometrySha256','materialSha256','collisionSha256','shadowSha256'])assert.deepEqual(off[key],original[key],'Shadow intensity control changed noncolor '+key);
 assert(original.calls>0&&original.triangles>0,'Empty original shadow control render');assert(original.draws.some(draw=>draw.phase==='shadow'),'Original control has no shadow submissions');assert(original.shadowTargets.length>0,'Original control has no shadow target');
 assert.deepEqual(off.shadowTargets.map(({evidenceName,...row})=>row),original.shadowTargets.map(({evidenceName,...row})=>row),'Shadow control changed target identity');
 assert(readRaw(off.matrixEvidenceName).equals(readRaw(original.matrixEvidenceName)),'Shadow control changed actual matrix bytes');
 for(let i=0;i<original.shadowTargets.length;i++)assert(readRaw(off.shadowTargets[i].evidenceName).equals(readRaw(original.shadowTargets[i].evidenceName)),'Shadow control changed raw shadow bytes');
 const color=pixelDiff(readRaw(original.colorEvidenceName),readRaw(off.colorEvidenceName));assert(color.changedPixels>=16,'Ineffective saved shadow intensity control');return color;
}
function validatePlan(context,style,partition){
 const selected=PARTITIONS[partition],plan={version:1,styles:STYLES,cases:CASES,partitions:PARTITIONS,controlCase:selected[0],lanes:LANES,controlLanes:CONTROL_LANES,warmupRenders:3,minimumControlPixels:16,deadlineMinutes:35};
 assert.deepEqual(context.plan,plan,'Fixed plan changed');assert.equal(context.planSha256,canonicalHash(plan),'Fixed plan hash');
 assert.deepEqual(context.selectedCases,selected);assert.deepEqual(context.casePlan.map(x=>x.name),CASES);
 const a=[94.62,161.41],b=[433.59,773.67],length=699.8306713055665,width=26,ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
 assert.deepEqual(context.bridgeBasis,{a,b,length,width,ux,uz},'Original map bridge basis changed');
 const fixed=[{position:[0,6,0],target:[160,4,290]},{position:[480,8,830],target:[630,3,1050]},{position:[1290,7,1115],target:[1330.8,9,1174.7]}];
 for(const [index,pose]of context.casePlan.entries()){
  assert.equal(pose.index,index);assert.equal(pose.frozenTime,120+index);assert.equal(pose.hour,index<6&&index%2?21:14);
  for(const key of ['position','target']){assert.equal(pose[key].length,3);pose[key].forEach(v=>finite(v,'Pose coordinate'));}
  if(index<6){assert.deepEqual(pose.position,fixed[Math.floor(index/2)].position);assert.deepEqual(pose.target,fixed[Math.floor(index/2)].target);assert.equal(pose.recipe,undefined);}
  else{
   const expected=index===6?{position:[-130,width/2+.35,.18],target:[-6,width/2-.35,.04]}:{position:[-60,0,-.65],target:[8,width/2+4,.1]};
   for(const key of ['position','target']){
    const [s,w,heightOffset]=expected[key],r=pose.recipe?.[key];assert(r,'Original bridge pose recipe missing');finite(r.terrainHeight,'Original terrain height');
    assert.deepEqual(r,{s,w,heightOffset,terrainHeight:r.terrainHeight,position:[a[0]+ux*s+uz*w,r.terrainHeight+heightOffset,a[1]+uz*s-ux*w]},'Bridge-derived camera recipe changed');assert.deepEqual(pose[key],r.position);
   }
  }
 }
 assert.equal(context.style,style);assert.equal(context.partition,partition);
}
function drawAudit(frame,programs){
 integer(frame.calls,'Native calls',1);finite(frame.triangles,'Native triangles');assert(frame.triangles>0);assert(Array.isArray(frame.draws)&&frame.draws.length>0);
 const delta=frame.poolDelta;for(const key of ['renderCalls','pooledCalls','colorCalls','shadowCalls'])integer(delta?.[key],'Pool '+key);
 assert.equal(delta.renderCalls,1);assert(delta.colorCalls>0);assert.equal(delta.pooledCalls,delta.colorCalls+delta.shadowCalls);
 let calls=0,color=0,shadow=0;
 for(const draw of frame.draws){
  for(const key of ['object','sourceGeometry','material','start','count','program','nativeCalls'])integer(draw[key],'Draw '+key);
  assert.equal(typeof draw.name,'string');assert(['color','shadow'].includes(draw.phase));assert.equal(typeof draw.substituted,'boolean');assert(programs.has(draw.program),'Draw lacks saved linked shader');
  assert.equal(draw.transformWords.length,82,'Submitted matrix word count');const bytes=Buffer.alloc(82*4);
  draw.transformWords.forEach((word,i)=>{integer(word,'Matrix word');assert(word<=0xffffffff);bytes.writeUInt32LE(word,i*4);});for(let i=0;i<bytes.length;i+=8)finite(bytes.readDoubleLE(i),'Submitted matrix value');
  calls+=draw.nativeCalls;if(draw.substituted){if(draw.phase==='color')color++;else shadow++;}
 }
 assert.equal(calls,frame.calls,'Draw accounting');assert.equal(color,delta.colorCalls);assert.equal(shadow,delta.shadowCalls);
}
function cameraAudit(camera,pose,frame,matrix){
 const direction=pose.target.map((n,i)=>n-pose.position[i]),length=Math.sqrt(direction.reduce((n,v)=>n+v*v,0));
 assert(Math.sqrt(camera.direction.reduce((n,v,i)=>n+(v-direction[i]/length)**2,0))<1e-12,'Saved camera direction differs from fixed target');
 const near=.08,far=22000,top=near*Math.tan((Math.PI/180)*.5*60),height=2*top,width=(WIDTH/HEIGHT)*height,left=-.5*width,right=left+width,bottom=top-height;
 const projection=[2*near/(right-left),0,0,0,0,2*near/(top-bottom),0,0,(right+left)/(right-left),(top+bottom)/(top-bottom),-(far+near)/(far-near),-1,0,0,-2*far*near/(far-near),0];
 assert(camera.projection.every((v,i)=>v===projection[i]),'Saved original projection changed');
 const matches=frame.matrixObjects.map((object,index)=>({object,index})).filter(({object,index})=>object.type==='PerspectiveCamera'&&object.parentId===null&&camera.matrix.every((v,i)=>v===matrix.readDoubleLE((index*32+16+i)*8)));
 assert.equal(matches.length,1,'Captured Float64 matrix does not contain exactly one planned main camera');
 for(const mesh of frame.geometryMeshes){const index=frame.matrixObjects.findIndex(object=>object.id===mesh.id);assert(index>=0,'Original mesh absent from full matrix receipt');assert.equal(mesh.matrix.length,16);assert(mesh.matrix.every((v,i)=>v===matrix.readDoubleLE((index*32+i)*8)),'Geometry-local matrix differs from captured Float64 bytes');}
}

/** Each call audits one artifact; raw buffers are loaded lazily and discarded after each case. */
export async function auditWorldArtifacts({directory,report,expectedProofHead,expectedProofTree,expectedProofFiles,validators}){
 assert.match(expectedProofHead,blobPattern);assert.match(expectedProofTree,blobPattern);
 for(const name of ['decodePng','exactFrame','verifyUpload','verifyTextureFrame'])assert.equal(typeof validators?.[name],'function','Required independent validator '+name);
 const dir=resolve(directory);assert(lstatSync(dir).isDirectory()&&!lstatSync(dir).isSymbolicLink(),'Artifact directory is not regular');
 const entries=await readdir(dir,{withFileTypes:true}),allowedFiles=new Set(['report.json','final-result.json','evidence.ndjson','events.ndjson','fixture.js','bundle-metafile.json']);
 for(const entry of entries)assert(entry.isFile()&&!entry.isSymbolicLink(),'Unexpected directory/symlink in artifact '+entry.name);
 const file=filename=>{assert(typeof filename==='string'&&basename(filename)===filename&&!filename.includes('\\')&&!filename.includes('\0'),'Unsafe artifact filename');const path=resolve(dir,filename);assert(lstatSync(path).isFile()&&!lstatSync(path).isSymbolicLink(),'Artifact file is not regular');return path;};
 const read=filename=>{const path=file(filename);assert(lstatSync(path).size<=128*1024*1024,'Artifact file exceeds bounded audit input');return readFileSync(path);};
 assert.deepEqual(JSON.parse(read('report.json')),report,'Caller report differs from saved report.json');
 assert.equal(report.schema,'belle-rg8-world-proof-v1');assert.equal(report.passed,true,'Failed/incomplete proof artifact');assert.equal(report.compileOnly,false,'Compile-only artifact cannot pass');
 assert.equal(report.compiled,true,'Immutable graph was not compiled');assert.equal(report.cleanup?.complete,true,'Cleanup is incomplete');assert.equal(report.cleanup.timedOut,false,'Cleanup timed out');noErrors(report.cleanup.errors,'Cleanup errors');
 noErrors(report.errors,'Report errors');noErrors(report.failedRequests,'Failed source requests');
 assert.equal(report.proofHead,expectedProofHead,'Stale proof head');assert.equal(report.proofTree,expectedProofTree,'Stale proof tree');
 for(const [key,value]of Object.entries({baseline:BASELINE,baselineTree:BASELINE_TREE,candidate:CANDIDATE,candidateTree:CANDIDATE_TREE}))assert.equal(report[key],value,'Wrong retained source '+key);
 const {style,partition,backend}=report;assert(STYLES.includes(style));assert(['metal','swiftshader'].includes(backend));assert(Object.hasOwn(PARTITIONS,partition));assert(backend==='metal'?partition==='all':partition!=='all');
 assert.equal(typeof report.browserVersion,'string');assert(report.browserVersion.length>0);
 exactNames(expectedProofFiles.map(x=>x.path),PROOF_FILES,'Current proof files');
 const sources=new Map(),receipts=new Map(),jsonReceipts=new Map(),rawReceipts=new Map(),usedJson=new Set(),usedRaw=new Set(),expectedEvidence=new Set();
 for(const row of report.sourceReceipts){assert(!sources.has(row.path),'Duplicate provenance receipt');assert.match(row.sha256,hashPattern);assert.match(row.blob,blobPattern);sources.set(row.path,row);}
 const packagePaths=Object.keys(SOURCE_PINS).filter(path=>/package(-lock)?\.json$/.test(path));
 exactNames([...sources.keys()],[...PROOF_FILES,...packagePaths],'Retained proof/package provenance inventory');
 for(const expected of expectedProofFiles){assert.match(expected.sha256,hashPattern);assert.match(expected.blob,blobPattern);assert.deepEqual(sources.get(expected.path),expected,'Proof payload changed: '+expected.path);}
 for(const path of packagePaths){assert.equal(sources.get(path).sha256,SOURCE_PINS[path].sha256);assert.equal(sources.get(path).blob,SOURCE_PINS[path].blob);}
 const originalModules=new Map();for(const row of report.sources){sourcePath(row.path);assert(!originalModules.has(row.path),'Duplicate immutable module');for(const key of ['sha256','transformedSha256'])assert.match(row[key],hashPattern);assert.match(row.blob,blobPattern);assert(Array.isArray(row.transformations));originalModules.set(row.path,row);}
 const moduleInventory=[...originalModules.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0).map(row=>Object.fromEntries(['path','blob','sha256','transformedSha256','transformations'].map(key=>[key,row[key]])));
 assert.equal(moduleInventory.length,194,'Complete original module graph required');assert.equal(canonicalHash(moduleInventory),MODULE_INVENTORY_SHA256,'Immutable transformed source inventory changed');
 const fixture=read('fixture.js');assert.equal(sha256(fixture),report.fixtureSha256,'Saved immutable bundle changed');
 const metafile=JSON.parse(read('bundle-metafile.json')),outputs=Object.values(metafile.outputs);assert.equal(outputs.length,1);assert.equal(outputs[0].bytes,fixture.length,'Bundle output byte count');
 const inputs=new Map(),dependencies=new Map();for(const row of report.bundleInputs){assert(!inputs.has(row.path),'Duplicate bundle input');inputs.set(row.path,row);}
 exactNames([...inputs.values()].filter(x=>x.pinned).map(x=>x.path),Object.keys(metafile.inputs).filter(x=>x.startsWith('pinned-source:')),'Pinned bundle inventory');
 exactNames([...inputs.values()].filter(x=>x.pinned).map(x=>x.path),[...originalModules.keys()].map(path=>'pinned-source:'+path).concat("pinned-source:"+GAME+"/src/belle/waterfrontLayout.json with { type: 'json' }"),'Exact original module/JSON-attribute bundle inventory');
 for(const row of inputs.values()){
  if(row.pinned){const path=row.path.slice('pinned-source:'.length).replace(/ with \{ type: 'json' \}$/,'');sourcePath(path);assert(originalModules.has(path),'Pinned bundle input lacks provenance');}
  else if(row.generated){assert.deepEqual(row,{path:'<define:import.meta.env>',generated:true,value:'{}'});}
  else{assert.match(row.sha256,hashPattern);assert.equal(typeof row.dependency,'boolean');if(row.dependency){const path=row.path.replaceAll('\\','/');assert(path.includes('/node_modules/'));const name=path.split('/node_modules/').at(-1);assert(!dependencies.has(name),'Duplicate dependency');assert.equal(row.sha256,DEPENDENCY_PINS[name],'Original locked dependency changed');dependencies.set(name,row);}else{assert(row.path.replaceAll('\\','/').endsWith('/'+PROOF+'/browser.ts'));assert.equal(row.sha256,sources.get(PROOF+'/browser.ts').sha256);}}
 }
 assert.equal([...inputs.values()].filter(x=>!x.pinned&&!x.generated&&!x.dependency).length,1,'Unexpected application override in bundle');
 exactNames([...dependencies.keys()],Object.keys(DEPENDENCY_PINS),'Complete original dependency inventory');
 const metaDependencies=Object.keys(metafile.inputs).filter(path=>/(^|\/)node_modules\//.test(path));exactNames(metaDependencies.map(path=>path.split(/(?:^|\/)node_modules\//).at(-1)),Object.keys(DEPENDENCY_PINS),'Retained bundle dependency inventory');
 const metaApplication=Object.keys(metafile.inputs).filter(path=>!path.startsWith('pinned-source:')&&path!=='<define:import.meta.env>'&&!/(^|\/)node_modules\//.test(path));assert.equal(metaApplication.length,1);assert(metaApplication[0].endsWith('/'+PROOF+'/browser.ts'),'Unexpected retained application bundle input');
 assert.equal(inputs.size,Object.keys(metafile.inputs).length);assert.deepEqual(report.definitions,{'import.meta.env.PROD':'false','import.meta.env.BASE_URL':'"/"','import.meta.env':'{}'});
 const events=read('events.ndjson').toString('utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));assert.deepEqual(events,report.events,'Incremental event receipts changed');
 const compiled=events.filter(x=>x.type==='compiled');assert.equal(events.length,2,'Exactly source-only and runtime compile events required');assert.equal(compiled.length,2);assert.deepEqual(compiled.map(({at,...event})=>event),Array.from({length:2},()=>({type:'compiled',fixtureSha256:report.fixtureSha256,pinnedModules:originalModules.size})),'Compile provenance diverged');assert(Number.isFinite(Date.parse(compiled[0].at))&&Date.parse(compiled[1].at)>=Date.parse(compiled[0].at),'Compile event chronology');
 const assets=new Map();for(const row of report.assets){sourcePath(row.path);assert(!assets.has(row.path),'Duplicate asset provenance');assert.match(row.blob,blobPattern);assert.match(row.sha256,hashPattern);integer(row.bytes,'Asset size',1);integer(row.requests,'Asset requests');exactNames(row.urls,row.urls,'Asset URLs');for(const url of row.urls)assert(typeof url==='string'&&url.startsWith('/')&&!url.startsWith('//')&&!url.includes('\\'));assets.set(row.path,row);}
 for(const [path,row]of assets){const pin=ASSET_PINS[path];assert(pin,'Unpinned world asset: '+path);for(const key of ['sha256','blob','bytes'])assert.equal(row[key],pin[key],'Original asset provenance '+path+' '+key);}
 for(const path of REQUIRED_ASSETS)assert(assets.get(path)?.requests>0,'Pinned original asset was not consumed: '+path);
 exactNames([...assets.keys()].filter(path=>path.startsWith(GAME+'/public/belle/skins/')&&path.endsWith('-detail.webp')),DETAIL_NAMES.map(name=>GAME+'/public/belle/skins/'+name),'Detail asset inventory');
 const incremental=read('evidence.ndjson').toString('utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));assert.deepEqual(incremental,report.evidence,'Incremental evidence manifest differs');
 const failures=[];let checkedBytes=0,pngCount=0;
 for(const receipt of report.evidence){
  safeName(receipt.name);assert(!receipts.has(receipt.name),'Duplicate evidence name');receipts.set(receipt.name,receipt);assert(['json','pixels','binary'].includes(receipt.kind));
  const expectedFile=receipt.name+(receipt.kind==='json'?'.json':receipt.kind==='pixels'?'.rgba.gz':'.matrix.gz');assert.equal(receipt.file,expectedFile);assert(!allowedFiles.has(receipt.file),'Artifact filename aliases another receipt');allowedFiles.add(receipt.file);assert.match(receipt.sha256,hashPattern);
  if(receipt.png){assert.equal(receipt.kind,'pixels');assert.equal(receipt.png.file,receipt.name+'.png');assert(!allowedFiles.has(receipt.png.file));allowedFiles.add(receipt.png.file);integer(receipt.png.bytes,'PNG byte count',1);assert(receipt.png.bytes<=MAX_RAW);assert.match(receipt.png.sha256,hashPattern);}
  try{
   const bytes=read(receipt.file);checkedBytes+=bytes.length;
   if(receipt.kind==='json'){integer(receipt.bytes,'JSON size',1);assert(receipt.bytes<=MAX_RAW);assert.equal(bytes.length,receipt.bytes);assert.equal(sha256(bytes),receipt.sha256,'Saved JSON hash');JSON.parse(bytes);jsonReceipts.set(receipt.name,receipt);}
   else{
    integer(receipt.bytes,'Raw byte count',1);assert(receipt.bytes<=MAX_RAW);integer(receipt.compressedBytes,'Compressed byte count',1);assert(receipt.compressedBytes<=96*1024*1024);assert.match(receipt.compressedSha256,hashPattern);assert.equal(bytes.length,receipt.compressedBytes);assert.equal(sha256(bytes),receipt.compressedSha256,'Compressed evidence hash');
    const raw=gunzipSync(bytes,{maxOutputLength:receipt.bytes});assert.equal(raw.length,receipt.bytes);assert.equal(sha256(raw),receipt.sha256,'Raw evidence hash');
    if(receipt.kind==='pixels'){assert.equal(receipt.format,'RGBA8-bottom-up');integer(receipt.width,'Pixel width',1);integer(receipt.height,'Pixel height',1);assert.equal(raw.length,receipt.width*receipt.height*4);}
    else{assert.equal(receipt.format,'Float64-matrix-bytes');assert.equal(raw.length%8,0);for(let offset=0;offset<raw.length;offset+=8)finite(raw.readDoubleLE(offset),'Retained Float64 matrix');}
    if(receipt.png){const bytes=read(receipt.png.file);checkedBytes+=bytes.length;assert.equal(bytes.length,receipt.png.bytes);assert.equal(sha256(bytes),receipt.png.sha256,'Saved PNG hash');const decoded=validators.decodePng(bytes,receipt.width,receipt.height);assert.equal(decoded.readPixelsSha256,receipt.sha256,'Independent PNG/raw pixels');pngCount++;}
    rawReceipts.set(receipt.name,receipt);
   }
  }catch(error){failures.push(new Error(receipt.name+': '+error.message));}
 }
 exactNames(entries.map(x=>x.name),[...allowedFiles],'Complete artifact file inventory');if(failures.length)throw new AggregateError(failures,'Corrupt or missing evidence files');
 const readJson=name=>{expectedEvidence.add(name);usedJson.add(name);const receipt=jsonReceipts.get(name);assert(receipt,'Missing JSON evidence '+name);const bytes=read(receipt.file);assert.equal(sha256(bytes),receipt.sha256);return JSON.parse(bytes);};
 const context=readJson(style+'-context'),initialEvidence=readJson(style+'-initial-textures'),final=readJson(style+'-final');
 assert.deepEqual(JSON.parse(read('final-result.json')),report.result,'Saved final return differs');assert.deepEqual(final,report.result,'Browser final receipt differs');
 for(const value of [context,initialEvidence,final]){assert.equal(value.baseline,BASELINE);assert.equal(value.style,style);}
 assert.equal(context.schema,'belle-rg8-world-proof-v1');assert.equal(final.schema,'belle-rg8-world-proof-final-v1');assert.equal(final.passed,true);noErrors(final.errors,'Browser terminal errors');assert.equal(final.partition,partition);
 validatePlan(context,style,partition);for(const key of ['casePlan','bridgeBasis','publication','gpu','software','width','height','threeRevision','selectedCases'])assert.deepEqual(final[key],context[key],'Final context drift '+key);
 assert.equal(context.width,WIDTH);assert.equal(context.height,HEIGHT);assert.equal(context.dpr,1);assert.equal(context.near,.08);assert.equal(context.far,22000);assert.equal(context.samples,4);assert.equal(context.threeRevision,'185');
 assert.equal(context.software,backend==='swiftshader');assert.match(context.gpu,backend==='metal'?/ANGLE Metal Renderer:.*Apple/:/SwiftShader/);if(backend==='metal')assert(!/SwiftShader|llvmpipe/i.test(context.gpu));
 for(const [key,value]of Object.entries({antialias:true,alpha:false,preserveDrawingBuffer:true,depth:true,stencil:false}))assert.equal(context.context[key],value,'Actual WebGL context '+key);
 assert.equal(context.assetBarrier.frozen,true);assert.equal(context.assetBarrier.baseline,BASELINE);assert.equal(context.assetBarrier.candidate,CANDIDATE);assert.equal(context.assetBarrier.proofHead,expectedProofHead);assert.equal(context.assetBarrier.requests,[...assets.values()].reduce((n,row)=>n+row.requests,0));
 assert.equal(context.publication.frozenTime,119);assert.deepEqual(context.publication.position,[0,6,0]);integer(context.publication.updates,'Original pack publication updates',1);finite(context.publication.elapsedMs,'Original pack publication elapsed time');assert(context.publication.elapsedMs>=0&&context.publication.elapsedMs<300000,'Original pack publication exceeded five minutes');
 const poolIdentity=stats=>({preparedEntries:stats.preparedEntries,activeEntries:stats.activeEntries,pageCount:stats.pageCount,poolBytes:stats.poolBytes,pages:stats.pages,preparationAttempts:stats.preparationAttempts,preparationRenders:stats.preparationRenders,preparationFrames:stats.preparationFrames,preparationReady:stats.preparationReady,fallbacks:stats.fallbacks,observerErrors:stats.observerErrors,contextLosses:stats.contextLosses});
 assert.deepEqual(final.poolBefore,context.poolBefore);assert(context.poolBefore.supported&&context.poolBefore.preparationReady&&context.poolBefore.activeEntries>=200);assert.equal(context.poolBefore.fallbacks,0);assert.equal(context.poolBefore.observerErrors,0);assert.deepEqual(poolIdentity(final.poolAfter),poolIdentity(context.poolBefore));
 const expectedPrelude=partition==='linux-b'?context.casePlan.slice(0,4).map(p=>({name:p.name,frozenTime:p.frozenTime,warmupRenders:3})):[];assert.deepEqual(final.prelude,expectedPrelude);
 assert.deepEqual(context.initialUploads,initialEvidence.initialUploads);const firstUploads=initialEvidence.initialUploads;exactNames(firstUploads.map(x=>x.name),DETAIL_NAMES,'Original detail uploads');
 const initial=new Map(firstUploads.map(row=>[row.name,row])),liveAllocations=new Map(),allocationIds=new Set(),origins=new Set(),allUploads=[...firstUploads];
 for(const row of firstUploads){
  const state=row.state;assert.equal(row.reason,'initial-original');assert.equal(state.width,512);assert.equal(state.height,512);const url=new URL(state.url);assert.equal(url.protocol,'http:');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/belle/skins/'+row.name);assert.equal(url.search,'');assert.equal(url.hash,'');assert.equal(url.username,'');assert.equal(url.password,'');origins.add(url.origin);
  assert(assets.get(GAME+'/public/belle/skins/'+row.name).urls.includes(url.pathname),'Actual detail URL absent from served asset receipts');
  for(const [key,value]of Object.entries({type:THREE.UnsignedByteType,colorSpace:THREE.NoColorSpace,channel:0,wrapS:THREE.RepeatWrapping,wrapT:THREE.RepeatWrapping,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,flipY:true,premultiplyAlpha:false,unpackAlignment:4,generateMipmaps:true,matrixAutoUpdate:true}))assert.equal(state[key],value,'Original detail setting '+key);
  finite(state.anisotropy,'Detail anisotropy');assert(state.anisotropy>=1&&state.anisotropy<=8);integer(state.imageId,'Image identity',1);assert.equal(typeof state.textureUuid,'string');assert.equal(typeof state.sourceUuid,'string');
  for(const [key,value]of Object.entries({offset:[0,0],repeat:[1,1],center:[0,0],rotation:0,matrix:[1,0,0,0,1,0,0,0,1]}))assert.deepEqual(state[key],value,'Original detail UV state '+key);
  validators.verifyUpload(row,'original',state,THREE);assert(!allocationIds.has(row.nativeTextureId),'Aliased first native allocation');allocationIds.add(row.nativeTextureId);liveAllocations.set(row.name,row.nativeTextureId);
 }
 assert.equal(origins.size,1);for(const key of ['textureUuid','sourceUuid','imageId'])assert.equal(new Set(firstUploads.map(row=>row.state[key])).size,28,'Original detail identity alias');
 const programs=new Map();for(const name of jsonReceipts.keys())if(name.startsWith(style+'-program-')){const p=readJson(name);integer(p.id,'Program id');assert.equal(name,style+'-program-'+p.id);assert(!programs.has(p.id));assert.equal(p.linked,true);assert(typeof p.vertex==='string'&&p.vertex.length>0&&typeof p.fragment==='string'&&p.fragment.length>0);assert.equal(sha256(p.vertex),p.vertexSha256);assert.equal(sha256(p.fragment),p.fragmentSha256);programs.set(p.id,p);}
 assert(programs.size>0);exactNames(final.programIds,[...programs.keys()],'Final program IDs');const usedPrograms=new Set(),cases=[],caseFailures=[];let peakRawBytes=0;
 for(const [index,caseName]of PARTITIONS[partition].entries()){
  const rawCache=new Map();let cacheBytes=0;
  const readRaw=name=>{expectedEvidence.add(name);usedRaw.add(name);if(rawCache.has(name))return rawCache.get(name);const receipt=rawReceipts.get(name);assert(receipt,'Missing raw evidence '+name);const compressed=read(receipt.file);assert.equal(sha256(compressed),receipt.compressedSha256);const raw=gunzipSync(compressed,{maxOutputLength:receipt.bytes});assert.equal(raw.length,receipt.bytes);assert.equal(sha256(raw),receipt.sha256);rawCache.set(name,raw);cacheBytes+=raw.length;peakRawBytes=Math.max(peakRawBytes,cacheBytes);return raw;};
  try{
   const prefix=style+'-'+caseName,lanes=index===0?[...LANES,...CONTROL_LANES]:LANES,sceneEvidence=readJson(prefix+'-scene'),item=readJson(prefix+'-case'),pose=context.casePlan.find(p=>p.name===caseName),frames=new Map();
   assert.equal(sceneEvidence.style,style);assert.deepEqual(sceneEvidence.pose,pose);assert.deepEqual(sceneEvidence.prelude,expectedPrelude);assert.equal(canonicalHash(sceneEvidence.geometry),sceneEvidence.geometrySha256);assert.equal(canonicalHash(sceneEvidence.materials),sceneEvidence.materialSha256);assert.match(sceneEvidence.collisionSha256,hashPattern);
   assert.equal(item.name,caseName);assert.equal(item.style,style);assert.deepEqual(item.pose,pose);assert.equal(item.passed,true);noErrors(item.errors,'Case errors '+caseName);assert.deepEqual(item.frameNames,lanes.map(lane=>prefix+'-'+lane+'-frame'));
   for(const key of ['geometrySha256','materialSha256','collisionSha256'])assert.equal(item[key],sceneEvidence[key],'Case fingerprint drift '+key);
   assert.deepEqual(item.camera.position,pose.position);assert.deepEqual(item.camera.target,pose.target);assert.equal(item.camera.matrix.length,16);assert.equal(item.camera.projection.length,16);assert.equal(item.camera.direction.length,3);for(const values of [item.camera.matrix,item.camera.projection,item.camera.direction])values.forEach(v=>finite(v,'Actual camera value'));assert.deepEqual(item.camera.matrix.slice(12,15),pose.position);
   for(const lane of lanes){
    const name=prefix+'-'+lane,frame=readJson(name+'-frame');assert.equal(frame.name,name);assert.equal(frame.caseName,caseName);assert.equal(frame.lane,lane);assert.equal(frame.style,style);validators.verifyTextureFrame(frame,initial,THREE);
    const mode=lane==='rg8'?'rg8':lane==='lost-g'?'lost-g':'original';
    for(const row of frame.uploads){assert.equal(row.reason,mode);assert.equal(row.priorNativeTextureId,liveAllocations.get(row.name),'Broken native allocation transition');assert(!allocationIds.has(row.nativeTextureId),'Reused native allocation ID');allocationIds.add(row.nativeTextureId);liveAllocations.set(row.name,row.nativeTextureId);allUploads.push(row);}
    for(const state of frame.textures)assert.equal(state.nativeTextureId,liveAllocations.get(state.name),'Frame did not use its recorded live allocation');
    assert.equal(frame.colorEvidenceName,name+'-color');assert.equal(frame.matrixEvidenceName,name+'-matrices');const color=readRaw(frame.colorEvidenceName),matrix=readRaw(frame.matrixEvidenceName),colorReceipt=rawReceipts.get(frame.colorEvidenceName),matrixReceipt=rawReceipts.get(frame.matrixEvidenceName);
    assert.equal(color.length,WIDTH*HEIGHT*4);assert.equal(colorReceipt.width,WIDTH);assert.equal(colorReceipt.height,HEIGHT);assert(colorReceipt.png,'Every color capture requires an independently decoded PNG');assert.equal(matrixReceipt.kind,'binary');assert.equal(matrix.length,frame.matrixObjects.length*32*8,'Matrix object/byte count');assert.equal(sha256(color),frame.rgbaSha256);assert.equal(sha256(matrix),frame.matrixSha256);
    const objectIds=new Set();for(const object of frame.matrixObjects){integer(object.id,'Matrix object');assert(!objectIds.has(object.id),'Duplicate matrix object');objectIds.add(object.id);assert(object.parentId===null||Number.isSafeInteger(object.parentId));assert.equal(typeof object.type,'string');assert.equal(typeof object.name,'string');assert.equal(typeof object.visible,'boolean');}
    for(const object of frame.matrixObjects)assert(object.parentId===null||objectIds.has(object.parentId),'Matrix graph parent missing');
    cameraAudit(item.camera,pose,{...frame,geometryMeshes:sceneEvidence.geometry.meshes},matrix);
    drawAudit(frame,programs);for(const draw of frame.draws){assert(objectIds.has(draw.object),'Submitted object not in full scene matrix receipt');usedPrograms.add(draw.program);}
    const shadowHash=createHash('sha256'),lightIds=new Set();assert(Array.isArray(frame.shadowTargets));assert(frame.shadowTargets.length>0,'Missing original shadow target');auditShadowLightStates(frame.shadowLights,frame);
    for(const [shadowIndex,target]of frame.shadowTargets.entries()){integer(target.lightId,'Shadow light');assert(!lightIds.has(target.lightId));lightIds.add(target.lightId);assert(objectIds.has(target.lightId));assert.equal(typeof target.textureUuid,'string');assert.equal(target.evidenceName,name+'-shadow-'+shadowIndex);const raw=readRaw(target.evidenceName),receipt=rawReceipts.get(target.evidenceName);assert.equal(receipt.kind,'pixels');assert.equal(receipt.width,target.width);assert.equal(receipt.height,target.height);assert.equal(raw.length,target.width*target.height*4);assert.equal(sha256(raw),target.sha256);shadowHash.update(raw);}
    assert.equal(shadowHash.digest('hex'),frame.shadowSha256,'Combined original shadow receipt');assert.equal(frame.geometrySha256,sceneEvidence.geometrySha256);assert.match(frame.materialSha256,hashPattern);assert.equal(frame.materialSha256,sceneEvidence.materialSha256);assert.equal(frame.collisionSha256,sceneEvidence.collisionSha256);frames.set(lane,frame);
   }
   const original=frames.get('original');for(const lane of lanes)if(lane!=='shadow-off')assert.deepEqual(frames.get(lane).shadowLights,original.shadowLights,'Noncontrol shadow-light state changed');for(const lane of ['rg8','restored']){validators.exactFrame(original,frames.get(lane),readRaw);assert.deepEqual(frames.get(lane).poolDelta,original.poolDelta);assert.deepEqual(frames.get(lane).shadowTargets.map(({evidenceName,sha256,...r})=>r),original.shadowTargets.map(({evidenceName,sha256,...r})=>r));}
   const strictComparison=value=>{for(const key of ['changedPixels','maxChannelDelta','shadowChangedPixels','shadowMaxChannelDelta'])assert.equal(value[key],0);for(const key of ['shadowTargetsEqual','orderEqual','countsEqual','poolDeltaEqual','matricesEqual'])assert.equal(value[key],true);};
   assert.deepEqual(item.comparisons.map(row=>row.lane),['rg8','restored']);item.comparisons.forEach(strictComparison);
   const audit={name:caseName,style,frames:lanes.length,exactLanes:['rg8','restored']};
   if(index===0){
    const lostG=pixelDiff(readRaw(original.colorEvidenceName),readRaw(frames.get('lost-g').colorEvidenceName)),shadowOff=pixelDiff(readRaw(original.colorEvidenceName),readRaw(frames.get('shadow-off').colorEvidenceName));assert(lostG.changedPixels>=16,'Ineffective saved lost-G control');assert(shadowOff.changedPixels>=16,'Ineffective saved shadow control');assert.deepEqual(item.controls.lostG,lostG);assert.deepEqual(item.controls.shadowOff,shadowOff);
    for(const [lane,key]of [['lost-g-restored','lostGRestored'],['shadow-restored','shadowRestored']]){validators.exactFrame(original,frames.get(lane),readRaw);assert.deepEqual(frames.get(lane).poolDelta,original.poolDelta);strictComparison(item.controls[key]);}
    assert.deepEqual(frames.get('lost-g').draws,original.draws,'Lost-G control changed unrelated submissions');assert.deepEqual(frames.get('lost-g').matrixObjects,original.matrixObjects);assert(readRaw(frames.get('lost-g').matrixEvidenceName).equals(readRaw(original.matrixEvidenceName)));
    const lostFrame=frames.get('lost-g'),offFrame=frames.get('shadow-off');for(const key of ['calls','triangles','shadowSha256'])assert.equal(lostFrame[key],original[key],'Lost-G control changed unrelated '+key);assert.deepEqual(lostFrame.poolDelta,original.poolDelta);assert.deepEqual(lostFrame.shadowTargets.map(({evidenceName,...row})=>row),original.shadowTargets.map(({evidenceName,...row})=>row));
    assert.deepEqual(auditShadowContributionControl(original,offFrame,frames.get('shadow-restored'),item.controls.shadowControl,readRaw),shadowOff,'Saved shadow intensity control differs');
    audit.controls={lostG,shadowOff,exactRestorations:2};
   }else assert.deepEqual(item.controls,{});
   const done=final.completed[index];assert.deepEqual(done,{name:caseName,passed:true,frameNames:item.frameNames,controls:item.controls});
   assert.deepEqual(report.independentCases[index],audit,'Retained independent summary differs from reconstructed pixels');
   const packs=context.publication.packs;assert.equal(packs.length,2);for(const [packIndex,pack]of packs.entries()){const expected=packIndex===0?{name:'street-at-sunset',meshes:495,nodes:496}:{name:'detroit-scenery',meshes:63,nodes:64};assert.equal(pack.url,'/__pinned_asset/'+GAME+'/src/belle/districtModels/'+expected.name+'.glb');assert.equal(pack.instancedMeshes,expected.meshes);assert.equal(pack.nodes,expected.nodes);const meshes=sceneEvidence.geometry.meshes.filter(mesh=>mesh.parentId===pack.rootId),instances=new Set(sceneEvidence.geometry.instanceBuffers.map(row=>row.id));assert.equal(meshes.length,expected.meshes,'Original published pack population');assert(meshes.every(mesh=>instances.has(mesh.id)&&pack.names.includes(mesh.name)),'Published pack instance identity');exactNames([...new Set(meshes.map(mesh=>mesh.name))],pack.names,'Published pack names');if(packIndex===0)assert.deepEqual(pack.names,['Street at Sunset · city blocks']);}
   cases.push(audit);
  }catch(error){caseFailures.push(new Error(caseName+': '+error.message));}
  finally{rawCache.clear();}
 }
 if(caseFailures.length)throw new AggregateError(caseFailures,'Saved world cases failed independent artifact audit');
 assert.deepEqual(cases.map(row=>row.name),PARTITIONS[partition]);assert.equal(report.independentCases.length,cases.length);assert.equal(final.completed.length,cases.length);exactNames([...usedPrograms],[...programs.keys()],'Actual linked program coverage');
 assert.deepEqual(final.uploadHistory,allUploads,'Retained native allocation history differs');assert.equal(final.uploadCount,allUploads.length);
 assert.deepEqual(final.persistedNames,report.evidence.slice(0,-1).map(row=>row.name),'Final persistence inventory changed');assert.equal(report.evidence.at(-1).name,style+'-final','Terminal evidence is not last');
 exactNames([...receipts.keys()],[...expectedEvidence],'Missing or extraneous semantic evidence');exactNames([...usedRaw],[...rawReceipts.keys()],'Unreferenced raw evidence');exactNames([...usedJson],[...jsonReceipts.keys()],'Unreferenced JSON evidence');
 return {passed:true,backend,style,partition,proofHead:expectedProofHead,proofTree:expectedProofTree,files:allowedFiles.size,receipts:receipts.size,checkedBytes,pngs:pngCount,programs:programs.size,sourceModules:originalModules.size,assets:assets.size,textureUploads:allUploads.length,cases:cases.length,frames:cases.reduce((n,row)=>n+row.frames,0),peakCaseRawBytes:peakRawBytes,scope:'Recomputed artifact integrity and complete fixed per-case evidence; no full-game release or speed acceptance.'};
}
