# Depot documentaire central

Ce dossier sert de base locale centralisee pour le module `Documentation`.

Structure prevue :

- `db/`
  - reserve pour les elements techniques du serveur documentaire
- `documents/`
  - depot principal des documents actifs par organisme et par processus
- `archives/`
  - documents archives
- `trash/`
  - documents supprimes logiquement avant nettoyage definitif
- `logs/`
  - journaux documentaires et traces d'actions

Principe retenu :

- les fichiers Word, PDF, Excel restent stockes physiquement sur `D:`
- la base SQLite stocke les metadonnees, la hierarchie et l'historique
- le serveur local Node.js rend ces donnees accessibles sur le reseau local

Hierarchie par defaut preparee cote serveur :

- `Processus_pilotage`
- `Processus_operationnel`
- `Processus_support`

Cette hierarchie sera pilotable ensuite depuis le module `Documentation`.
