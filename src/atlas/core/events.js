/* PROJECT ATLAS - Events between features.
   A tiny publish/subscribe helper, so one feature can react to another without
   importing it or overwriting its functions:

     on('enter-world', function(world){ ... });   // listen
     emit('enter-world', world);                  // notify

   Events in use:
     'enter-world'         a world is entered (argument: the world object)
     'sheet-lots-updated'  fresh sheet data arrived in the background

   This file must not import anything: modules that import each other in a
   circle are evaluated in an order the browser decides, and only a module
   without imports is guaranteed to be ready before everyone who uses it. */

const listeners = {};

export function on(name, fn){
  (listeners[name] = listeners[name] || []).push(fn);
}

export function emit(name, arg){
  (listeners[name] || []).forEach(function(fn){ fn(arg); });
}
