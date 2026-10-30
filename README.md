# FYAG-Grupo-C
# Proyecto Integrado, Grupo C (TIHI43/D-IEI-N4-P2-C1/D)


## Setup

1. Crear y activar ambiente:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
   Windows:
   ```powershell
   .venv\Scripts\activate
   ```
3. Instalar dependencias:
   ```bash
   pip install -r requirements.txt
   ```
4. Aplicar migraciones de BDD:
   ```bash
   python manage.py migrate
   ```
5. (opcional) crear superusuario:
   ```bash
   python manage.py createsuperuser
   ```
6. Correr el sv:
   ```bash
   python manage.py runserver
   ```
7. Visitar http://127.0.0.1:8000/

8. frond end (React):
    ```bash
   1. Entrar a la carpeta: "cd frontend"
   2. Instalar dependencias: "npm install" #*Ya instaladas 1 vez, se puede saltar este paso*
   3. Levantar servidor: "npm run dev"
   4. Salir del servidor:"Ctrl + c"
   5. Salir de la carpeta frondend en la termina: "cd .."
   ```

 
