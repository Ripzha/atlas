/* PROJECT ATLAS - Building data.
   Floor plans with lot coordinates (in percent of the image) per building.
   Requires IMG from src/atlas/config.js.

   Dependency: character-sheet.html reads this file as text and finds the
   BUILDINGS declaration by pattern (keyword const, the name, an equals sign and
   an opening brace). Keep the declaration in this form and do not write that
   pattern anywhere else in this file, not even in a comment. */

import { BASE, IMG } from '../config.js?v=202609181741';

export const BUILDINGS = {
  "Culpepper-Apartments":{imgs:[IMG+"pictures_u1170_BtwAdlUp.png"],lots:[
    {nr:"Nr. 1",x:40.7,y:40.3},
    {nr:"Nr. 2",x:52.6,y:32.4},
    {nr:"Nr. 3",x:61.1,y:45.6},
    {nr:"Nr. 4",x:48,y:63.9},
  ]},
  "Jasmin-Studios":{imgs:[IMG+"pictures_u1173_glSvpdsr.png"],lots:[
    {nr:"Nr. 5",x:44,y:40.3},
    {nr:"Nr. 6",x:58.1,y:54.4},
  ]},
  "Medina-Studios":{imgs:[IMG+"pictures_u1176_qXcTrNaj.png"],lots:[
    {nr:"Nr. 9",x:39.4,y:41.1},
    {nr:"Nr. 10",x:57.6,y:44},
    {nr:"Nr. 11",x:48.8,y:63.4},
  ]},
  "Hakim-Haus":{imgs:[IMG+"pictures_u1172_jgdhOcVw.png"],lots:[
    {nr:"Nr. 13",x:53.3,y:36.4},
    {nr:"Nr. 14",x:45.5,y:60.2},
  ]},
  "Landgraab-Apartments":{imgs:[IMG+"pictures_u1175_bPvqCfdS.png",IMG+"pictures_u1174_eIzqUPZL.png"],lots:[
    {nr:"Nr. 17",x:44.2,y:38.5},
    {nr:"Nr. 18",x:48.7,y:66.3},
  ]},
  "Alto-Apartments":{imgs:[IMG+"pictures_u1171_CbejBpJu.png"],lots:[
    {nr:"Nr. 21",x:45.4,y:39.3},
    {nr:"Nr. 22",x:59.4,y:51.5},
  ]},
  "ZenView-Apartments":{imgs:[IMG+"pictures_u1181_hVjZGEkW.png",IMG+"pictures_u1180_LhvsFNlx.png"],lots:[
    {nr:"Nr. 24",x:50.8,y:67.9},
    {nr:"Nr. 25",x:49.5,y:35.3},
  ]},
  "Spitzen-Apartments":{imgs:[IMG+"pictures_u1178_odPXQNxE.png",IMG+"pictures_u1179_KecVnlEU.png"],lots:[
    {nr:"Nr. 16",x:50,y:50},
  ]},
  "Luxusallee-21":{imgs:[IMG+"pictures_u1177_mzbSxfyX.png"],lots:[
    {nr:"Nr. 26",x:56.1,y:36.4},
    {nr:"Nr. 27",x:40.6,y:43.2},
    {nr:"Nr. 28",x:50.3,y:62.6},
  ]},
  "Kieferhügel-Apartments":{imgs:["https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1189_YPpEakrt.png"],lots:[
    {nr:"Nr. 12",x:47.7,y:54.3},
    {nr:"Nr. 13",x:58.8,y:46.7},
  ]},
    "Rabenfelsviertel":{imgs:[
    "https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t381p3447n5_bOxsVZnp.png",
    "https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t381p3447n6_nlUZQzDB.png",
    "https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t381p3447n7_TMtpNUXR.png",
    "https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t381p3447n8_VBnfvgxL.png"
  ],lots:[
    // all floors
    {nr:"Rabenfelsviertel (Gassen)",building:"Rabenfelsviertel",name:"Rabenfelsviertel (Gassen)",x:52.9,y:62.5,floors:[0,1,2],outdoor:true},
    // floors 2+3
    {name:"Nr. 5 - Raouls alte Wohnung",x:30.9,y:41.8,floors:[1,2],url:BASE+"t539f53861-Bloodmoon-Valley-Rabenfelsviertel-Nr-Raouls-alte-Wohnung-Harghita.html",active:false,img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t539p4580n2_SnkzUlHp.png"},
    {name:"Nr. 6 - Adams Haus",x:60.6,y:38.5,floors:[1,2],url:BASE+"t554f53861-Bloodmoon-Valley-Rabenfelsviertel-Haus-Nr-Adams-Haus-Harghita.html",active:false,img:"https://files.homepagemodules.de/b855163/resize/800x9999/f53861t554p4821n2_tLKzniAO.png"},
    {name:"Nr. 7 - Coles Haus",x:73,y:45.9,floors:[1,2],url:BASE+"t396f53861-Bloodmoon-Valley-Rabenfelsviertel-Haus-Nr-Coles-Haus-Harghita.html",active:false,img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t396p3500n10_WSeYrfmy.png"},
    {name:"Nr. 8 - Taverne Zum roten Raben",x:32.2,y:63.3,floors:[1,2],url:BASE+"t388f53861-Bloodmoon-Valley-Rabenfelsviertel-Haus-Nr-Taverne-Zum-roten-Raben-Harghita.html",active:false,img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t388p3472n5_JojYPQXK.png"},
    {name:"Nr. 9 - Jacks Haus",x:70.2,y:68.3,floors:[1,2],url:BASE+"t387f53861-Bloodmoon-Valley-Rabenfelsviertel-Haus-Nr-Jacks-Haus-Harghita.html",active:false,img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t387p3470n8_ZXeuEjlO.png"},
    {name:"Nr. 3 - Frei",x:55.1,y:18,floors:[1,2],free:true,active:false},
    {name:"Nr. 4 - Frei",x:72.4,y:17.8,floors:[1,2],free:true,active:false},
    {name:"Nr. 10 - Frei",x:38.9,y:90.6,floors:[1,2],free:true,active:false},
    {name:"Nr. 11 - Yasmins Haus",x:64.6,y:92.5,floors:[1,2],active:false},
    // floors 2+3+4
    {name:"Nr. 2 - Frei",x:30.5,y:18,floors:[1,2,3],free:true,active:false},
    // floor 1
    {name:"Nr. 1 - Frei",x:64.7,y:12.3,floors:[0],free:true,active:false},
  ]},
    "Schattenmarktviertel":{imgs:[
    "https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t400p3507n4_sXkBObeL.png",
    "https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t400p3507n3_tHoMvGaN.png",
    "https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t400p3507n2_QkAZHmvp.png"
  ],lots:[
    // all floors
    {nr:"Schattenmarktviertel (Gassen)",building:"Schattenmarktviertel",name:"Schattenmarktviertel (Gassen)",x:48.9,y:65.5,outdoor:true},
    {name:"Nr. A - Andenken an Alucard",x:49.5,y:23.4,url:BASE+"t552f53861-Bloodmoon-Valey-Schattenmarktviertel-Haus-Nr-A-Andenken-an-Alucard-Harghita.html",active:false,img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t552p4813n12_IwZNGjMT.png"},
    // floor 1
    {name:"Nr. 3 - Zum Sündigen Nachtvogel",x:62.6,y:66,floors:[0,1,2],url:BASE+"t486f53861-Bloodmoon-Valey-Schattenmarktviertel-Haus-Nr-Zum-Suendigen-Nachtvogel-Harhita.html",active:false,img:"https://files.homepagemodules.de/b855163/resize/1000x9999/f53861t486p4068n4_NfYvjTMO.png"},
    {name:"Nr. 1 - Frei",x:39.4,y:40.1,floors:[0,1],free:true,active:false},
    {name:"Nr. 2 - Frei",x:63.7,y:50.2,floors:[0,1],free:true,active:false},
    {name:"Nr. 4 - Frei",x:63.4,y:82.2,floors:[0,1,2],free:true,active:false},
    {name:"Nr. 5 - Frei",x:33.3,y:84.5,floors:[0,1],free:true,active:false},
    // floors 2+3
    {name:"Nr. 6 - Frei",x:33.2,y:70,floors:[1,2],free:true,active:false},
    {name:"Nr. 7 - Frei",x:33,y:61.1,floors:[1,2],free:true,active:false},
    {name:"Nr. 8 - Frei",x:33.2,y:53.5,floors:[1,2],free:true,active:false},
    {name:"Nr. 9 - Frei",x:32.2,y:26.7,floors:[1],free:true,active:false},
    {name:"Nr. 10 - Frei",x:39.3,y:35.6,floors:[1,2],free:true,active:false},
    {name:"Nr. 11 - Frei",x:49.8,y:41.3,floors:[1,2],free:true,active:false},
    {name:"Nr. 12 - Frei",x:54,y:39.7,floors:[1,2],free:true,active:false},
    {name:"Nr. 13 - Frei",x:62.9,y:19.4,floors:[1,2],free:true,active:false},
    // floor 3
    {name:"Nr. 16 - Jacks Unterschlupf",x:32,y:47.3,floors:[2],url:BASE+"t398f53861-Bloodmoon-Valley-Schattenmarktviertel-Haus-Nr-Jacks-Unterschlupf-Harghita.html",active:false,img:"https://files.homepagemodules.de/b855163/resize/1920x1200/f53861t398p3504n3_CAyrzJKG.png"},
    {name:"Nr. 14 - Frei",x:62.8,y:44.1,floors:[2],free:true,active:false},
    {name:"Nr. 15 - Frei",x:33.5,y:83.3,floors:[2],free:true,active:false},
    {name:"Nr. 17 - Frei",x:32.6,y:28,floors:[2],free:true,active:false},
  ]},
    "Steinweg-Apartments":   {imgs:["https://files.homepagemodules.de/b855163/resize/1920x1200/pictures_u1190_LpkviBnU.png"],lots:[
    {nr:"Nr. 14",x:43.9,y:51.1},
    {nr:"Nr. 15",x:53.9,y:46.6},
  ]},
  "Seeblick Appartments":   {imgs:[IMG+"pictures_u1188_HlaIWmsV.png"],lots:[
    {nr:"Nr. 15",x:43.9,y:55.2},
    {nr:"Nr. 16",x:53.5,y:45.8},
  ]},
  "Sturmhöhe Appartments":  {imgs:[IMG+"pictures_u1187_RzFNAGjD.png"],lots:[
    {nr:"Nr. 17",x:45,y:56.9},
    {nr:"Nr. 18",x:55,y:47.7},
  ]},
};
