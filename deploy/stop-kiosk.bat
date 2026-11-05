@echo off
:: Arrêt propre du kiosque
title Kiosque Touristique Madagascar — Arrêt
echo.
echo  Arret du kiosque en cours...
pm2 stop all
pm2 delete all
echo.
echo  Tous les serveurs arretes.
echo  Fermez manuellement la fenetre du navigateur si necessaire.
echo.
pause

