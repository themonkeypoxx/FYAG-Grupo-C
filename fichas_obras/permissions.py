from rest_framework.permissions import BasePermission

#Comentarios dejados en este script son para entender el código
#Estoy conciente de que todos estamos aprendiendo sobre la marcha
# y si no dejo por escrito lo que hago puedo olvidarlo. Considerar sacarlos
# para la entrega final el 30 de noviembre -Ismael

#Esta clase es un ejemplo de permiso personalizado para verificar si un 
# usuario pertenece a un rol específico.
class EsRol(BasePermission):
    rol_requerido = None
    #DRF llama a este método cada q una petición llega 
    def has_permission(self, request, view):
        #esto verifica q el user este logeado y q pertenezca al rol que se requiere
        return (
            request.user.is_authenticated
            and request.user.groups.filter(name=self.rol_requerido).exists()
        )
class EsGerencial(EsRol): rol_requerido = "Gerencial"
class EsSupervisor(EsRol): rol_requerido = "Supervisor"
class EsAdministrativo(EsRol): rol_requerido = "Administrativo"
class EsTecnico(EsRol): rol_requerido = "Tecnico"