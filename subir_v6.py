#!/usr/bin/env python3
"""
subir_v6.py — Sube TODOS los archivos del proyecto a GitHub (fuerza V6)
Ejecutar desde la raíz del proyecto: python subir_v6.py
"""

import subprocess
import sys
import datetime

RUTA_PROYECTO = r"D:\Ruddy\Escritorio\Nexus Agendamiento\nexus-booking"

def run(cmd, check=True):
    print(f"  $ {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=RUTA_PROYECTO)
    if result.stdout.strip():
        print(f"    {result.stdout.strip()}")
    if result.stderr.strip():
        print(f"    ⚠️  {result.stderr.strip()}")
    if check and result.returncode != 0:
        print(f"\n❌ Falló: {cmd}")
        sys.exit(1)
    return result

def main():
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"\n🚀 Subiendo V6 completa a GitHub — {ts}")
    print(f"📁 Proyecto: {RUTA_PROYECTO}")
    print("=" * 55)

    # Verificar que es el repo correcto
    r = run("git remote -v", check=False)
    if "RuddxLab" not in r.stdout:
        print("❌ No se encontró el remote de RuddxLab.")
        print("   Asegúrate de estar en la carpeta correcta del proyecto.")
        sys.exit(1)
    print("✅ Repo correcto: RuddxLab/Nexus-Booking")

    # Ver qué cambió
    print("\n📋 Archivos modificados:")
    run("git status --short", check=False)

    # Agregar TODO
    print("\n📦 Agregando todos los archivos...")
    run("git add -A")

    # Ver qué se va a commitear
    result = run("git diff --cached --name-only", check=False)
    archivos = result.stdout.strip()

    if not archivos:
        print("ℹ️  No hay cambios nuevos. Haciendo commit vacío para forzar redeploy...")
        run(f'git commit --allow-empty -m "chore: force redeploy V6 [{ts}]"')
    else:
        cantidad = len(archivos.splitlines())
        print(f"\n📁 {cantidad} archivo(s) a subir:")
        print(f"   {archivos.replace(chr(10), chr(10)+'   ')}")
        run(f'git commit -m "V6: deploy completo [{ts}]"')

    # Push
    print("\n⬆️  Subiendo a GitHub...")
    run("git push origin main")

    print("\n✅ ¡Listo! V6 subida a GitHub.")
    print("👁  Cloudflare Pages debería iniciar el build en ~30 segundos.")
    print("    Monitorea en: https://dash.cloudflare.com → Pages → Deployments")

if __name__ == "__main__":
    main()