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

2. Configurar variables de entorno (.env):
   Crear o verificar el archivo `.env` en la raíz con las credenciales de Supabase:
   ```env
   SUPABASE_URL=https://clratpzepthoadgzftvd.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscmF0cHplcHRob2FkZ3pmdHZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDQyMTEsImV4cCI6MjEwOTEyMDIxMX0.ZK9uZALNnkv1Qgliw26uElkf1pXskXwSY6YzjjbhiiI
   # (Opcional) Para conexión directa del ORM a PostgreSQL Supabase:
   # DATABASE_URL=postgresql://postgres.clratpzepthoadgzftvd:[TU_PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require
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
   2. Configurar "frontend/.env" con:
      VITE_API_URL=http://127.0.0.1:8000/
      VITE_SUPABASE_URL=https://clratpzepthoadgzftvd.supabase.co
      VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscmF0cHplcHRob2FkZ3pmdHZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDQyMTEsImV4cCI6MjEwOTEyMDIxMX0.ZK9uZALNnkv1Qgliw26uElkf1pXskXwSY6YzjjbhiiI
   3. Instalar dependencias: "npm install" #*Ya instaladas 1 vez, se puede saltar este paso*
   4. Levantar servidor: "npm run dev"
   5. Salir del servidor: "Ctrl + c"
   6. Salir de la carpeta frontend en la terminal: "cd .."
   ```

 
