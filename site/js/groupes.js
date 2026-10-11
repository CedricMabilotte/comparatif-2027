// Groupes : mode séance, kit d'animation, réseau d'animateurs.
"use strict";
R.module("groupes", (R) => {
  R.$("#groupes").innerHTML = `<h2>Groupes</h2><p class="aide">En construction.</p>`;
  R.route("groupes", () => { R.montrer("groupes"); });
});
