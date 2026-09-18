/* PROJECT ATLAS - Forum sections of the RPG worlds.
   Maps the Xobor forum id (the "f51782" in a thread address) to the world
   name used in the sheet and in ATLAS. */

export const FORUM_WORLDS = {
  '51778': 'Willow Creek',     '51779': 'Oasis Springs',    '51780': 'Newcrest',
  '51781': 'Magnolia Promenade','51782': 'Windenburg',      '51783': 'San Myshuno',
  '51784': 'Forgotten Hollow', '51785': 'Brindleton Bay',   '51786': 'Del Sol Valley',
  '51787': 'Strangerville',    '51788': 'Sulani',           '51789': 'Glimmerbrook',
  '51790': 'Britechester',     '51791': 'Evergreen Harbor', '51792': 'Mt. Komorebi',
  '51793': 'Henford-on-Bagley','51794': 'Tartosa',          '51795': 'Moonwood Mill',
  '51796': 'Copperdale',       '51797': 'San Sequoia',      '51798': 'Granite Falls',
  '51799': 'Selvadorada',      '55177': 'Chestnut Ridge',   '58300': 'Tomarang',
  '58925': 'Ciudad Enamorada', '59271': 'Ravenwood',        '59567': 'Nordhaven',
  '59907': 'Innisgreen',       '60506': 'Gibbi Point',      '60507': 'Ondarion',
  '53861': 'Bloodmoon Valley',
};

// "Orte ausserhalb von Simswelt": each thread in this forum is a world of its own.
export const OUTER_WORLDS_FORUM = '51855';

// World of a thread address, or null. In the outer-worlds forum the world name
// comes from the thread slug: /t652f51855-Toronto.html -> "Toronto". Xobor adds
// "-2", "-3" … when a slug already exists; that suffix is removed.
export function worldFromUrl(url){
  const f = (url.match(/f(\d+)/) || [])[1];
  if(!f) return null;
  if(FORUM_WORLDS[f]) return FORUM_WORLDS[f];
  if(f === OUTER_WORLDS_FORUM){
    const slug = (url.match(/t\d+f51855-([A-Za-z0-9\-]+)\.html/) || [])[1];
    if(slug) return slug.replace(/-\d+$/, '').replace(/-/g, ' ').trim();
  }
  return null;
}
