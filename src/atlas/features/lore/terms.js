/* PROJECT ATLAS - Occult lore: terms that link to the topic explaining them.

   A name like "Morpidianer" or "Sinenima" in a card becomes a link to its
   topic; on devices with a mouse, hovering shows that topic's first sentence.
   Only names are listed here, never everyday words like "Vampir", or every
   second line would be a link.

   Each entry:
     forms    spellings to find, each matched as a whole word, case-sensitive
     chapter  chapter number in the lore document
     topic    start of the topic title ("## 6.8 …"), case does not matter
     card     optional: start of a point title ("### 6.8.1 …") inside it

   Targets are found by title, not by number, so renumbering the document
   does not break them. A target that cannot be found is left out quietly:
   the word then stays plain text. */

export const TERMS = [
  // Worlds and places
  { forms: ['Bloodmoon Valley', 'Bloodmoon Valleys'], chapter: '2', topic: 'Bloodmoon Valley' },
  { forms: ['Harghita'], chapter: '2', topic: 'Bloodmoon Valley', card: 'Harghita' },
  { forms: ['Transsylvanien'], chapter: '2', topic: 'Transsylvanien' },
  { forms: ['Unterwelt'], chapter: '2', topic: 'Die Unterwelt' },
  { forms: ['Infinite Ocean'], chapter: '2', topic: 'Infinite Ocean' },
  { forms: ['Zauberwald', 'Zauberwaldes', 'Zauberwalds'], chapter: '2', topic: 'Der magische Wald' },
  { forms: ["Sahra'"], chapter: '2', topic: 'Sahra' },
  { forms: ['Welt zwischen den Welten'], chapter: '2', topic: 'Die Welt zwischen den Welten' },
  { forms: ['Zauberallee'], chapter: '2', topic: 'Die Zauberallee' },
  { forms: ['Utopia'], chapter: '2', topic: 'Magische Welt' },
  { forms: ['Earth 616'], chapter: '2', topic: 'Earth 616' },

  // Order and institutions
  { forms: ['Rat des Gleichgewichts', 'Rates des Gleichgewichts'], chapter: '3', topic: 'Rat des Gleichgewichts' },
  { forms: ['Institut der Geheimnisse'], chapter: '3', topic: 'Institut der Geheimnisse' },
  { forms: ['Deathdealer', 'Deathdealern', 'Deathdealers'], chapter: '3', topic: 'Deathdealer' },

  // Magic
  { forms: ['Nekromantie'], chapter: '4', topic: 'Nekromantie' },
  { forms: ['Blutmagie'], chapter: '4', topic: 'Blutmagie' },
  { forms: ['Karma'], chapter: '1', topic: 'Karma' },

  // Artefacts and potions
  { forms: ['Elementarkristalle', 'Elementarkristallen', 'Elementkristalle'], chapter: '5', topic: 'Die vier Elementarkristalle' },
  { forms: ['Stab der Bindung'], chapter: '5', topic: 'Stab der Bindung' },
  { forms: ['Geisterortungsstein'], chapter: '5', topic: 'Geisterortungsstein' },
  { forms: ['Portschlüssel', 'Portschlüsseln'], chapter: '5', topic: 'Portschlüssel' },
  { forms: ['Zeitlinien-Kompass'], chapter: '5', topic: 'Zeitlinien-Kompass' },
  { forms: ['Sonnenwende-Trank', 'Sonnenwende-Tranks'], chapter: '5', topic: 'Zaubertränke', card: 'Sonnenwende-Trank' },
  { forms: ['Anma-Sud', 'Anma-Suds'], chapter: '5', topic: 'Zaubertränke', card: 'Anma-Sud' },

  // Vampires
  { forms: ['Blutseuche'], chapter: '6', topic: 'Blutseuche und Sinenima' },
  { forms: ['Sinenima'], chapter: '6', topic: 'Blutseuche und Sinenima' },
  { forms: ['Alucard', 'Alucards'], chapter: '2', topic: 'Bloodmoon Valley', card: 'Alucard' },

  // Werewolves
  { forms: ['Lupus Noctis'], chapter: '7', topic: 'Lupus Noctis' },
  { forms: ['Lupus Mana'], chapter: '7', topic: 'Lupus Noctis' },
  { forms: ['Lucian', 'Lucians'], chapter: '7', topic: 'Lucian-Glaube' },
  { forms: ['Lykaner'], chapter: '7', topic: 'Grundlagen' },

  // Ocean
  { forms: ['Leviathan', 'Leviathans'], chapter: '8', topic: 'Leviathan' },
  { forms: ['Sirenen', 'Sirene'], chapter: '8', topic: 'Sirenen' },

  // Enchanted forest
  { forms: ['Lichtgeister', 'Lichtgeist', 'Lichtgeistern', 'Lichtwesen', 'Limina'], chapter: '9', topic: 'Lichtgeister' },
  { forms: ['Nymphen', 'Nymphe'], chapter: '9', topic: 'Nymphen' },
  { forms: ['Zentauren', 'Zentaur'], chapter: '9', topic: 'Zentauren' },
  { forms: ['Einhörner', 'Einhörnern', 'Einhorn', 'Einhorns'], chapter: '9', topic: 'Einhörner' },
  { forms: ['Faune', 'Faunen'], chapter: '9', topic: 'Faune' },
  { forms: ['Elben'], chapter: '9', topic: 'Elben' },

  // Goblins and small creatures
  { forms: ['Goblins', 'Goblin'], chapter: '10', topic: 'Goblins' },
  { forms: ['Schattenschnüffler', 'Schattenschnüfflern'], chapter: '10', topic: 'Schattenschnüffler' },

  // Underworld
  { forms: ['Dämonen'], chapter: '11', topic: 'Dämonen' },
  { forms: ['Harpyien', 'Harpyie'], chapter: '11', topic: 'Harpyien' },
  { forms: ['Schattenkreaturen'], chapter: '11', topic: 'Schattenkreaturen' },

  // Created beings, spirits, Loa, aliens
  { forms: ['Pflanzenwesen'], chapter: '12', topic: 'Pflanzenwesen' },
  { forms: ['Seelenlose', 'Seelenlosen'], chapter: '18', topic: 'Nur benannte', card: 'Seelenlose' },
  { forms: ['Bwonsamdi'], chapter: '14', topic: 'Bwonsamdi' },
  { forms: ['Baron Samedi'], chapter: '14', topic: 'Baron Samedi' },
  { forms: ['Morpidianer', 'Morpidianern', 'Morpidia'], chapter: '15', topic: 'Morpidianer' },

  // Hybrids
  { forms: ['Dhampire', 'Dhampir', 'Dhampiren'], chapter: '16', topic: 'Dhampire' },
  { forms: ['Ungeblüter', 'Ungeblütern'], chapter: '16', topic: 'Ungeblüter' },
  { forms: ['Trogule', 'Trogulen'], chapter: '16', topic: 'Trogule' },
  { forms: ['Trogier', 'Trogiern'], chapter: '16', topic: 'Trogier' },
  { forms: ['Lumicula'], chapter: '16', topic: 'Lumicula' }
];
