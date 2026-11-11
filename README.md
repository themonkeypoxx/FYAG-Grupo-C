# FYAG-Grupo-C
# Proyecto Integrado, Grupo C (TIHI43/D-IEI-N4-P2-C1/D)

# Borrar este info dps:

  ```
  REESTRUCTURACIÓN:
   Modelos de obras y tecnicos: apps/obras
   Modelos de administrativo y clientes: apps/administrativo
  - Ismael, 10-11-2026 !
  ```

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
2. Instalar dependencias:
   ```bash
   pip install -r requirements.txt
   ```
3. Aplicar migraciones de BDD:
   ```bash
   python manage.py migrate
   ```
4. (opcional) crear superusuario:
   ```bash
   python manage.py createsuperuser
   ```
5. Correr el sv:
   ```bash
   python manage.py runserver
   ```
6. Visitar http://127.0.0.1:8000/

7. frond end (React):
    ```bash
   1. Entrar a la carpeta: "cd frontend"
   2. Instalar dependencias: "npm install" #*Ya instaladas 1 vez, se puede saltar este paso*
   3. Levantar servidor: "npm run dev"
   4. Salir del servidor:"Ctrl + c"
   5. Salir de la carpeta frondend en la termina: "cd .."
   ```

 8. Usuarios de prueba para cada módulo (Todos tienen la contraseña Prueba1234*):
     ```bash
      1. gerente_test@fyag.cl - username = gerente_test
      2. supervisor_test@fyag.cl - username = supervisor_test 
      3. admin_test@fyag.cl - username = admin_test
      4. tecnico_test@fyag.cl - username = tecnico_test
   ```
 
