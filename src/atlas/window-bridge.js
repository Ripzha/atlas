/* PROJECT ATLAS - Window bridge.
   Inline handlers in the markup and in generated HTML (onclick="goBack()")
   run in the global scope and cannot see module functions. The functions they
   call are attached to window here — in one place, so the list is easy to
   check. When an inline handler is replaced by addEventListener, remove its
   function from this list. */

import { closeSheet, openSheet } from './ui/mobile-sheets.js?v=202609221359';
import { mobileDotOpen } from './ui/mobile-dot-bar.js?v=202609221359';
import { toggleLegend } from './ui/legend.js?v=202609221359';
import {
  closeOtherWorlds,
  openOtherWorld,
} from './features/otherworlds/otherworld-view.js?v=202609221359';
import { changeBuildingFloor } from './features/buildings/building-view.js?v=202609221359';
import {
  clearBuildingCalib,
  copyBuildingCalib,
  toggleBuildingCalib,
} from './features/buildings/building-calibration.js?v=202609221359';
import { clearCalib, copyCalib, toggleCalib } from './features/admin/calibration.js?v=202609221359';
import { closeAdmin, setAdminTab } from './features/admin/admin-panel.js?v=202609221359';
import { buildAssignUI } from './features/admin/lot-assignment.js?v=202609221359';
import {
  charSearchFilter,
  closeCharView,
  openCharView,
  reloadChars,
  resetAllFilters,
  switchCharTab,
  toggleAgeFilter,
  toggleAgeGroup,
  toggleCharSort,
  toggleGenderFilter,
  togglePlayerFilter,
} from './features/characters/character-view.js?v=202609221359';
import { closeAtlas } from './features/forum-bridge/forum-bridge.js?v=202609221359';
import { goBack } from './features/map/world-view.js?v=202609221359';

Object.assign(window, {
  closeSheet, openSheet, mobileDotOpen, toggleLegend, closeOtherWorlds,
  openOtherWorld, changeBuildingFloor, clearBuildingCalib, copyBuildingCalib,
  toggleBuildingCalib, clearCalib, copyCalib, toggleCalib, closeAdmin,
  setAdminTab, buildAssignUI, charSearchFilter, closeCharView, openCharView,
  reloadChars, resetAllFilters, switchCharTab, toggleAgeFilter,
  toggleAgeGroup, toggleCharSort, toggleGenderFilter, togglePlayerFilter,
  closeAtlas, goBack,
});
