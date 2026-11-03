# Relaywork pour Windows

1. Télécharge **Relaywork-0.1.0-windows-x64.zip** dans les fichiers de cette version.
2. Clique droit sur le fichier ZIP, puis **Extraire tout**.
3. Ouvre le dossier extrait **Relaywork-win32-x64**.
4. Double-clique sur **relaywork.exe**. Garde les autres fichiers à côté de l’exécutable.

Cette version est destinée à **Windows x64** et ne demande pas d’installation de Node.js. Les données restent sur cet ordinateur, dans `%APPDATA%\Relaywork`. C’est une démonstration avec des comptes exemples ; l’authentification de production et la synchronisation cloud ne sont pas connectées.

L’application n’est pas signée numériquement. Windows peut signaler un éditeur inconnu ; aucune désactivation des protections Windows n’est nécessaire ni recommandée. Le fichier `.sha256` permet de vérifier l’intégrité de l’archive.

Le workflow GitHub **Windows desktop download** compile l’application sur Windows et teste l’exécutable avant de publier ce téléchargement.
