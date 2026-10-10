"""Génère le jeu de démonstration FICTIF du prototype (aucun parti réel).
Chaque proposition cite mot pour mot le texte source de sa candidature."""
import json, pathlib

racine = pathlib.Path(__file__).resolve().parent.parent

candidatures = [
  {"id": "territoires", "nom": "Alliance des Territoires", "sigle": "ADT", "fictif": True,
   "candidat": "Candidate fictive A", "statut_programme": "publie",
   "presentation": "Mouvement fictif centré sur la nation, les territoires et la production locale."},
  {"id": "horizon", "nom": "Horizon Social", "sigle": "HS", "fictif": True,
   "candidat": "Candidat fictif B", "statut_programme": "attendu",
   "presentation": "Mouvement fictif centré sur la redistribution, le travail et les services publics."},
  {"id": "progres", "nom": "Union Libérale et Progrès", "sigle": "ULP", "fictif": True,
   "candidat": "Candidate fictive C", "statut_programme": "partiel",
   "presentation": "Mouvement fictif centré sur la liberté d'entreprendre, la modernisation et l'Europe."},
]

# Documents de référence. Quand le programme 2027 n'existe pas encore, on s'appuie
# sur le programme précédent, présenté explicitement comme une archive.
documents = [
  {"id": "territoires-2027", "candidature": "territoires", "titre": "Programme 2027 : Relever les territoires",
   "type": "programme", "annee": 2027, "archive": False, "date": "2026-09-15"},
  {"id": "horizon-2022", "candidature": "horizon", "titre": "Programme présidentiel 2022 : L'horizon en commun",
   "type": "programme", "annee": 2022, "archive": True, "date": "2022-01-20",
   "justification": "Programme 2027 annoncé pour janvier 2027. En attendant, les fiches citent le programme 2022."},
  {"id": "progres-2027", "candidature": "progres", "titre": "Premières propositions 2027 : Libérer, moderniser",
   "type": "propositions", "annee": 2027, "archive": False, "date": "2026-10-01",
   "justification": "Document partiel : le programme complet est attendu en février 2027."},
]
doc_de = {d["candidature"]: d for d in documents}

themes = [
  {"id": "travail", "nom": "Travail et emploi"},
  {"id": "securite", "nom": "Sécurité et justice"},
]

concepts = [
  {"id": "travail", "nom": "Travail"},
  {"id": "merite", "nom": "Mérite"},
  {"id": "solidarite", "nom": "Solidarité"},
  {"id": "liberte", "nom": "Liberté"},
  {"id": "protection", "nom": "Protection"},
  {"id": "securite", "nom": "Sécurité"},
  {"id": "ordre", "nom": "Ordre"},
  {"id": "justice", "nom": "Justice"},
  {"id": "souverainete", "nom": "Souveraineté"},
  {"id": "peuple", "nom": "Peuple"},
]

# (candidature, thème, concepts, citation)
props = [
  ("territoires","travail",["travail","souverainete","protection"],
   "Nous relocaliserons la production industrielle en réservant une part de la commande publique aux entreprises implantées en France."),
  ("territoires","travail",["travail","merite","peuple"],
   "Le travail doit payer davantage que l'assistance : nous augmenterons le salaire net en baissant les cotisations sur les bas salaires."),
  ("territoires","travail",["protection","peuple","souverainete"],
   "Chaque bassin de vie disposera d'un guichet unique de l'emploi géré au plus près du terrain."),
  ("territoires","securite",["ordre","securite","peuple"],
   "Nous rétablirons l'ordre dans chaque quartier par une présence policière visible et permanente."),
  ("territoires","securite",["justice","ordre"],
   "Toute peine prononcée sera exécutée, et nous construirons les places de prison nécessaires."),
  ("territoires","securite",["souverainete","securite","protection"],
   "La sécurité commence aux frontières : nous rétablirons des contrôles nationaux permanents."),

  ("horizon","travail",["travail","solidarite","protection"],
   "Nous réduirons le temps de travail pour partager l'emploi et garantir à chacun un revenu digne."),
  ("horizon","travail",["solidarite","justice","travail"],
   "Le salaire minimum sera revalorisé et les écarts de rémunération seront plafonnés dans chaque entreprise."),
  ("horizon","travail",["liberte","travail","protection"],
   "Les salariés siégeront à parité dans les conseils d'administration des grandes entreprises."),
  ("horizon","securite",["securite","solidarite","protection"],
   "La sécurité est d'abord un droit social : nous réinvestirons dans les services publics de proximité."),
  ("horizon","securite",["justice","liberte"],
   "Nous développerons les peines alternatives à la prison pour lutter contre la récidive."),
  ("horizon","securite",["securite","justice","peuple"],
   "Une police de proximité sera recréée, formée à la prévention et contrôlée par une autorité indépendante."),

  ("progres","travail",["liberte","travail","merite"],
   "Nous simplifierons le droit du travail pour libérer l'embauche dans les petites entreprises."),
  ("progres","travail",["merite","travail","justice"],
   "La formation tout au long de la vie deviendra un compte personnel que chacun pilote librement."),
  ("progres","travail",["travail","solidarite","merite"],
   "Le retour à l'emploi sera accompagné par un contrat d'engagement réciproque entre l'allocataire et le service public."),
  ("progres","securite",["securite","liberte","ordre"],
   "Nous équiperons les forces de l'ordre d'outils numériques modernes, dans le respect des libertés publiques."),
  ("progres","securite",["justice","merite"],
   "La justice sera rendue plus rapide grâce à la numérisation complète des procédures."),
  ("progres","securite",["securite","souverainete","protection"],
   "La protection des Français passe par une coopération européenne renforcée en matière de police et de renseignement."),
]

# Lexique : ce que chaque candidature met dans un concept (démonstration).
lexique = {
  "travail": {
    "territoires": "Source de dignité nationale, à protéger de la concurrence étrangère.",
    "horizon": "Activité à partager et à émanciper, objet de droits collectifs.",
    "progres": "Liberté d'entreprendre et de se former, moteur de la mobilité individuelle."},
  "merite": {
    "territoires": "Récompense de l'effort face à l'assistance.",
    "horizon": "Terme peu employé ; l'égalité des conditions prime sur le mérite.",
    "progres": "Valeur centrale : chacun progresse selon ses choix et ses efforts."},
  "solidarite": {
    "territoires": "Solidarité nationale, d'abord entre membres de la communauté.",
    "horizon": "Principe structurant : redistribution et services publics.",
    "progres": "Solidarité conditionnelle, fondée sur des engagements réciproques."},
  "liberte": {
    "territoires": "Liberté collective de la nation de décider pour elle-même.",
    "horizon": "Liberté réelle, rendue possible par les droits sociaux.",
    "progres": "Liberté individuelle d'entreprendre, de choisir, d'innover."},
  "protection": {
    "territoires": "Protéger des menaces extérieures : frontières, concurrence.",
    "horizon": "Protéger des aléas de la vie : chômage, précarité.",
    "progres": "Protéger par la coopération et la modernisation."},
  "securite": {
    "territoires": "Ordre public et contrôle des frontières.",
    "horizon": "Droit social, lié aux services publics et à la prévention.",
    "progres": "Efficacité des moyens, numérique et coopération européenne."},
  "ordre": {
    "territoires": "Valeur cardinale, à rétablir.",
    "horizon": "Terme rare ; remplacé par prévention et proximité.",
    "progres": "Employé dans « forces de l'ordre », sans charge particulière."},
  "justice": {
    "territoires": "Justice pénale : exécution des peines.",
    "horizon": "Justice sociale autant que pénale ; alternatives à la prison.",
    "progres": "Justice comme service public à rendre efficace."},
  "souverainete": {
    "territoires": "Souveraineté nationale, économique et territoriale.",
    "horizon": "Peu employé dans ces thèmes.",
    "progres": "Souveraineté partagée à l'échelle européenne."},
  "peuple": {
    "territoires": "Le peuple comme communauté nationale à défendre.",
    "horizon": "Le peuple comme ensemble des travailleurs et citoyens.",
    "progres": "Terme rare ; on parle plutôt des « Français » ou des individus."},
}

propositions = []
textes = {c["id"]: [] for c in candidatures}
for i, (cid, th, cs, cit) in enumerate(props, 1):
    textes[cid].append(cit)
    propositions.append({
      "id": f"p{i:03d}", "candidature": cid, "theme": th, "concepts": cs,
      "citation": cit,
      "source": {"document": doc_de[cid]["id"], "titre": doc_de[cid]["titre"], "fichier": f"sources/{doc_de[cid]['id']}.txt",
                 "page": 1 + (i % 3), "date": doc_de[cid]["date"], "archive": doc_de[cid]["archive"]},
      "statut": "demo"})

for old in (racine / "sources").glob("*.txt"):
    old.unlink()
for cid, phrases in textes.items():
    (racine / "sources" / f"{doc_de[cid]['id']}.txt").write_text(
      "PROGRAMME FICTIF DE DÉMONSTRATION. Aucun parti réel.\n\n" + "\n\n".join(phrases) + "\n", encoding="utf-8")

donnees = {"meta": {"version": "0.1.0", "avertissement": "Données fictives de démonstration. Aucune candidature réelle.",
                    "genere_le": "2026-10-10"},
           "candidatures": candidatures, "documents": documents, "themes": themes, "concepts": concepts,
           "propositions": propositions, "lexique": lexique}
(racine / "data" / "corpus.json").write_text(json.dumps(donnees, ensure_ascii=False, indent=2), encoding="utf-8")
print(len(propositions), "propositions")
