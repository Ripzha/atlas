/* PROJECT ATLAS - World data.
   worlds:           continent map dots (position in percent, color, forum link, image)
   otherworlds:      worlds outside the continent map
   OTHERWORLDS_DATA: entries shown in the "Andere Welten" portal
   WORLD_COLORS:     dot colors per world
   Requires BASE and IMG from src/atlas/config.js.
   Names, links and images from the Google Sheet take precedence at runtime. */

import { BASE, IMG } from '../config.js?v=202609201830';

export const worlds=[
  {name:"Innisgreen",x:58.7,y:66.5,color:"#4a8a5a",type:"Feen-Insel",url:BASE+"f59907-Innisgreen.html",img:IMG+"f51848t204p6439n2_JXoiSaHR.png"},
  {name:"Nordhaven",x:11,y:23.7,color:"#4a8aaa",type:"Fjordstadt",url:BASE+"f59567-Nordhaven.html",img:IMG+"f51848t204p5730n2_bcapNnET.png"},
  {name:"Ravenwood",x:63,y:13.1,color:"#5a5a3a",type:"Nebelhochland",url:BASE+"f59271-Ravenwood.html",img:IMG+"f51848t204p4824n2_TWBoOluh.png"},
  {name:"Granite Falls",x:40.8,y:10.3,color:"#3a6a3a",type:"Nationalpark",url:BASE+"f51798-Granite-Falls.html",img:IMG+"f51848t204p6440n4_YVXgMSor.png"},
  {name:"Chestnut Ridge",x:41.8,y:69,color:"#aa7a2a",type:"Ranch",url:BASE+"f55177-Chestnut-Ridge.html",img:IMG+"f51848t204p3080n2_UHnYvhOE.png"},
  {name:"Strangerville",x:32.1,y:71.2,color:"#8a3a5a",type:"Mysteriös",url:BASE+"f51787-Strangerville.html",img:IMG+"f51848t204p3069n2_YGvixVsh.png"},
  {name:"Evergreen Harbor",x:79.8,y:12.5,color:"#3a5a5a",type:"Hafen",url:BASE+"f51791-Evergreen-Harbor.html",img:IMG+"f51848t204p3073n2_DfshroRW.png"},
  {name:"San Sequoia",x:21.8,y:48.9,color:"#3a6a5a",type:"Pazifik",url:BASE+"f51797-San-Sequoia.html",img:IMG+"f51848t204p3079n2_uJtqbMOr.png"},
  {name:"Britechester",x:38.2,y:36.3,color:"#7a8a5a",type:"Universität",url:BASE+"f51790-Britechester.html",img:IMG+"f51848t204p3072n2_YRsCbFjy.png"},
  {name:"Forgotten Hollow",x:29.4,y:19,color:"#6a3a8a",type:"Vampire",url:BASE+"f51784-Forgotten-Hollow.html",img:IMG+"f51848t204p3066n2_JXpWTELe.png"},
  {name:"Copperdale",x:24,y:28.1,color:"#5a7a5a",type:"Kleinstadt",url:BASE+"f51796-Copperdale.html",img:IMG+"f51848t204p3078n2_kPwgBqFU.png"},
  {name:"Henford-on-Bagley",x:30.7,y:28.8,color:"#6a8a3a",type:"England",url:BASE+"f51793-Henford-on-Bagley.html",img:IMG+"f51848t204p3075n2_YXNhtBrg.png"},
  {name:"Glimmerbrook",x:47.9,y:14.1,color:"#7a3a9a",type:"Magie",url:BASE+"f51789-Glimmerbrook.html",img:IMG+"f51848t204p3071n2_fiXwYNJL.png"},
  {name:"Mt. Komorebi",x:22.3,y:13.9,color:"#9aaabb",type:"Gebirge",url:BASE+"f51792-Mt-Komorebi.html",img:IMG+"f51848t204p3074n2_jCIcfQSW.png"},
  {name:"Moonwood Mill",x:56.1,y:15.6,color:"#2a4a5a",type:"Werwölfe",url:BASE+"f51795-Moonwood-Mill.html",img:IMG+"f51848t204p3077n2_ycbLHtnP.png"},
  {name:"Brindleton Bay",x:71.1,y:35.9,color:"#3a7a7a",type:"Küste",url:BASE+"f51785-Brindleton-Bay.html",img:IMG+"f51848t204p3067n2_lgSCqfRT.png"},
  {name:"San Myshuno",x:58.3,y:24.6,color:"#3a4a7a",type:"Grossstadt",url:BASE+"f51783-San-Myshuno.html",img:IMG+"f51848t204p3065n2_bDAZuVYK.png"},
  {name:"Magnolia Promenade",x:50.5,y:35.7,color:"#7a6a5a",type:"Promenade",url:BASE+"f51781-Magnolia-Promenade.html",img:IMG+"f51848t204p3063n2_adLzKDsI.png"},
  {name:"Willow Creek",x:51,y:21.5,color:"#4a8a3a",type:"Südstaaten",url:BASE+"f51778-Willow-Creek.html",img:IMG+"f51848t204p3060n4_NyDxShWt.png"},
  {name:"Newcrest",x:40,y:26.4,color:"#7a8a5a",type:"Vorstadt",url:BASE+"f51780-Newcrest.html",img:IMG+"f51848t204p3062n2_otgEqnkR.png"},
  {name:"Windenburg",x:64.1,y:44.6,color:"#5a6a7a",type:"Altstadt",url:BASE+"f51782-Windenburg.html",img:IMG+"f51848t204p3064n2_psJRBMPY.png"},
  {name:"Del Sol Valley",x:13.9,y:73.9,color:"#c8a02a",type:"Hollywood",url:BASE+"f51786-Del-Sol-Valley.html",img:IMG+"f51848t204p3068n2_ubDiGjJP.png"},
  {name:"Oasis Springs",x:37.4,y:58.5,color:"#c87a2a",type:"Wüste",url:BASE+"f51779-Oasis-Springs.html",img:IMG+"f51848t204p3061n2_zxcBGyYe.png"},
  {name:"Sulani",x:68,y:90.5,color:"#2a9a8a",type:"Tropeninsel",url:BASE+"f51788-Sulani.html",img:IMG+"f51848t204p3070n2_zlTJqYjA.png"},
  {name:"Selvadorada",x:86.9,y:61.7,color:"#2a5a2a",type:"Dschungel",url:BASE+"f51799-Selvadorada.html",img:IMG+"f51848t204p6856n2_kZxrGtah.png"},
  {name:"Tomarang",x:83.6,y:81,color:"#2a7a5a",type:"Südostasien",url:BASE+"f58300-Tomarang.html",img:IMG+"f51848t204p3081n2_oltrqfsx.png"},
  {name:"Ciudad Enamorada",x:55.5,y:78.7,color:"#aa4a3a",type:"Latein",url:BASE+"f58925-Ciudad-Enamorada.html",img:IMG+"f51848t204p3786n2_wXzDyWOT.png"},
  {name:"Tartosa",x:35,y:87,color:"#b06a3a",type:"Mittelmeer",url:BASE+"f51794-Tartosa.html",img:IMG+"f51848t204p3076n2_nNWxrUDc.png"},
  {name:"Ondarion",x:40.9,y:49.2,color:"#8a7a3a",type:"Königreich",url:BASE+"f60507-Ondarion.html",img:IMG+"f51848t204p6856n4_dkluvaJX.png"},
  {name:"Gibbi Point",x:15.7,y:38.2,color:"#2a7a8a",type:"Küstenpunkt",url:BASE+"f60506-Gibbi-Point.html",img:IMG+"f51848t204p6440n2_HbYIrRJo.png"},
];

export const otherworlds=[
  {name:"Bloodmoon Valley",color:"#6a2a4a",type:"Vampirwelt",url:BASE+"f53861-Vampirwelt-Bloodmoon-Valley.html",img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t380p3446n2_bGsQFBhr.png"},
];

export const OTHERWORLDS_DATA=[
  {name:"Bloodmoon Valley",type:"Vampirwelt",img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t380p3446n2_bGsQFBhr.png",world:otherworlds[0]},
  {name:"Zauberallee",type:"Magische Welt",img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f51855t406p3532n2_obFYOumL.png",url:"https://www.simsforumrpg.de/t406f51855-Zauberallee.html"},
  {name:"Die Unterwelt",type:"Andere Welt",img:null,url:"https://www.simsforumrpg.de/t425f51855-Die-Unterwelt.html"},
  {name:"Der Zauberwald",type:"Magische Welt",img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f51855t90p1006n2_cgJWwteb.png",url:"https://www.simsforumrpg.de/t90f51855-Der-Zauberwald.html"},
  {name:"Europa",type:"Reale Welt",img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f51855t206p2661n2_LrURBnpa.jpg",url:"https://www.simsforumrpg.de/t206f51855-Kontinent-Europa.html"},
  {name:"Kanada",type:"Reale Welt",img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f51855t644p5918n2_KHliXsLA.png",url:"https://www.simsforumrpg.de/t644f51855-Kanada.html"},
  {name:"Die Welt zwischen den Welten",type:"Andere Welt",img:null,url:"https://www.simsforumrpg.de/t632f51855-Die-Welt-zwischen-den-Welten.html"},
  {name:"Magische Welt Utopia",type:"Magische Welt",img:null,url:"https://www.simsforumrpg.de/t489f51855-Magische-Welt-Utopia.html"},
  {name:"Vampirwelt - Transsylvanien",type:"Vampirwelt",img:null,url:"https://www.simsforumrpg.de/t340f51855-Vampirwelt-Transsylvanien.html"},
  {name:"Paralleluniversum - Oasis Springs",type:"Paralleluniversum",img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f51855t220p2764n2_XtTNcofK.png",url:"https://www.simsforumrpg.de/t220f51855-Paralleluniversum-Oasis-Springs.html"},
];

// Dot colors per world type
export var WORLD_COLORS={'Willow Creek':'#4a8a3a','Oasis Springs':'#c87a2a','Newcrest':'#3a7a8a','Forgotten Hollow':'#5a3a8a','Brindleton Bay':'#3a6aaa','Del Sol Valley':'#c8a02a','Strangerville':'#8a3a3a','Sulani':'#2a8aaa','Glimmerbrook':'#7a3a9a','Britechester':'#3a4a7a','Evergreen Harbor':'#4a7a5a','Mt. Komorebi':'#5a8aaa','Henford-on-Bagley':'#6a8a3a','Tartosa':'#c84a6a','Moonwood Mill':'#4a3a6a','Windenburg':'#5a6a7a','San Myshuno':'#7a4a3a','Granite Falls':'#4a6a3a','Chestnut Ridge':'#aa7a2a','Copperdale':'#6a5a3a','San Sequoia':'#3a7a5a','Bloodmoon Valley':'#6a2a4a'};
