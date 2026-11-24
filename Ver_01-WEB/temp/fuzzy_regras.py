from flask import abort
from apian.apps.hardware.actuators import Actuator
from apian.apps.logic.rules import get_rule
from apian.database import db
from sentry_sdk import add_breadcrumb, capture_message, capture_exception
from apian.logger import fuzzy_logger

def run_fuzzy():

    fuzzy_logger.info("\nIniciando execução da lógica fuzzy")
    try:
        return exec_fuzzy()
    except Exception as error:
        capture_exception(error)
        raise error
    finally:
        capture_message("Execução da lógica fuzzy")


def add_context(msg):
    fuzzy_logger.info(msg)

    add_breadcrumb(
        category='fuzzy',
        message=msg,
        level='info',
    )


def disable_fuzzy_actuators():
    default_fuzzy_actuators = {
        "aquecedor-1": False,
        "aquecedor-2": False,
        "aquecedor-3": False,
        "aquecedor-4": False,
        "exaustor-1": False,
        "exaustor-2": False,
        "bomba-parede-umida": False
    }

    actuators = []

    for a in default_fuzzy_actuators:
        actuators.append({
            "id": a,
            "current_value": default_fuzzy_actuators[a]
        })

    Actuator.update(actuators)


def exec_fuzzy():

    add_context("chamando fuzzy...")
    config_doc = db().config.find_one({"_id": "hardware"})

    temp_var = "temp"
    if "use_temp_plant" in config_doc and config_doc["use_temp_plant"]:
        temp_var = "temp_plant"

    wind_doc = db().averages.find_one(
        {"$query": {"group_id": "rtWindAvgSpeed"}, "$orderby": {"create_at": -1}})
    tem_doc = db().averages.find_one(
        {"$query": {"group_id": "rtOutsideTemp"}, "$orderby": {"create_at": -1}})
    tim_doc = db().averages.find_one(
        {"$query": {"group_id": temp_var}, "$orderby": {"create_at": -1}})

    if not config_doc:
        return abort(500, "Configurações indiponíveis")

    if not wind_doc:
        return abort(500, "Direção do vento indiponíveis")

    if not tem_doc:
        return abort(500, "Tempertatura externa indiponíveis")

    if not tim_doc:
        return abort(500, "Tempertatura interna indiponíveis")

    add_context(f"""
    state={config_doc["state"]},
    wind={wind_doc["value"]},
    tem={tem_doc["value"]},
    tim={tim_doc["value"]}
    """)

    if not config_doc["fuzzy"]:
        add_context("Fuzzy desabilitada.")
        return

    actuators_list = compute_fuzzy(
        state=config_doc["state"],
        wind=wind_doc["value"],
        tem=tem_doc["value"],
        tim=tim_doc["value"]
    )

    add_context(f"actuators_list: {actuators_list}")
    
    actuators = []
    add_context(
        f"""Configuração de emergência: Sol - {config_doc["emergency"].get("sun")} / Vento {config_doc["emergency"].get("storm")}""")  

    for a in actuators_list:
        if not ((config_doc["emergency"].get("storm") and a in ["cortina-1", "cortina-2", "janela-1", "janela-2"]) or 
                (config_doc["aluminet_mode"] == "night" and a in ["aluminet"])):
            actuators.append({
                "id": a,
                "current_value": actuators_list[a]
            })

    add_context(f"Atuadores finais: {actuators}")

    config_doc = db().config.find_one({"_id": "hardware"})
    if config_doc["fuzzy"]:
        add_context(f"Atualizando atuadores")
        Actuator.update(actuators)

    return actuators


def compute_fuzzy(state, wind, tem, tim):
    add_context("chamando compute_fuzzy")
    fis = get_rule(state)
    fis.input['wind'] = wind

    if (state == "acclimatization"):
        fis.input['ate'] = tem
        fis.input['ati'] = tim
    else:
        fis.input['te'] = tem
        fis.input['ti'] = tim

    fis.compute()

    aref = float(fis.output['ref'])
    bhead = float(fis.output['hea'])

    return set_actuators(aref, bhead, state)


def set_actuators(aref, bhead, state):
    add_context("chamando set_actuators")

    fuzzy_actuators = {

        "aquecedor-1": False,
        "aquecedor-2": False,
        "aquecedor-3": False,
        "aquecedor-4": False,
        "exaustor-1": False,
        "exaustor-2": False,
        "bomba-parede-umida": False
    }

    """
    Atuadores relacionandos a fuzzy

    Definindo todos os atuadores que envolvem a fuzzy como dentro do valor 0 ou False

    Em outras palavras: desliga tudo

    """

    config_doc = db().config.find_one({"_id": "hardware"})

    cortina = False
    if "use_cortina" in config_doc and config_doc["use_cortina"]:
        cortina = True
        
    run_hot(fuzzy_actuators, bhead, state, cortina)
    run_cold(fuzzy_actuators, aref, state, cortina)

    return fuzzy_actuators

# regras de atuadores refrigeração e aquecimento
# decisoes refrigeracao


def run_cold(fuzzy_actuators, aref, state, cortina):
    match aref:
        case num if 20 <= num < 30:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [20,30[ -> Movendo cortinas para 0% (fechada); Abre janelas; Fecha forro; Abre aluminet")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["aluminet"] = 1
                add_context("Caso [20,30[ -> Abre janelas; Abre aluminet")

        case num if 30 <= num < 40:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [30,40[ -> Movendo cortinas para 0% (fechada); Abre janelas; Fecha forro; Abre aluminet")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 1
                fuzzy_actuators["cortina-2"] = 1
                add_context(
                    "Caso [30,40[ -> Movendo cortinas para 33%; Abre janelas; Abre aluminet")

        case num if 40 <= num < 50:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [40,50[ -> Movendo cortinas para 0% (fechada); Abre janelas; Fecha forro; Abre aluminet")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["forro"] = 1
                fuzzy_actuators["aluminet"] = 1
                if cortina:
                    fuzzy_actuators["cortina-1"] = 1
                    fuzzy_actuators["cortina-2"] = 1
                    add_context(
                        "Caso [40,50[ -> Movendo cortinas para 33%; Abre janelas; Abre forro; Abre aluminet")
                else:
                    fuzzy_actuators["cortina-1"] = 2
                    fuzzy_actuators["cortina-2"] = 2
                    add_context(
                        "Caso [40,50[ -> Movendo cortinas para 66%; Abre janelas; Abre forro; Abre aluminet")

        case num if 50 <= num < 60:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [50,60[ -> Movendo cortinas para 0% (fechada); Abre janelas; Fecha forro; Abre aluminet")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["forro"] = 1
                fuzzy_actuators["aluminet"] = 1
                if cortina:
                    fuzzy_actuators["cortina-1"] = 1
                    fuzzy_actuators["cortina-2"] = 1
                    add_context(
                        "Caso [50,60[ -> Movendo cortinas para 33%; Abre janelas; Abre forro; Abre aluminet")
                else:
                    fuzzy_actuators["cortina-1"] = 3
                    fuzzy_actuators["cortina-2"] = 3
                    add_context(
                        "Caso [50,60[ -> Movendo cortinas para 100% (aberta); Abre janelas; Abre forro; Abre aluminet")

        case num if 60 <= num < 70:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [60,70[ -> Movendo cortinas para 0% (fechada); Abre janelas; Fecha forro; Abre aluminet")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["forro"] = 1
                fuzzy_actuators["aluminet"] = 1
                if cortina:
                    fuzzy_actuators["cortina-1"] = 1
                    fuzzy_actuators["cortina-2"] = 1
                    add_context(
                        "Caso [60,70[ -> Movendo cortinas para 33%; Abre janelas; Abre forro; Abre aluminet")
                else:
                    fuzzy_actuators["cortina-1"] = 3
                    fuzzy_actuators["cortina-2"] = 3
                    add_context(
                        "Caso [60,70[ -> Movendo cortinas para 100% (aberta); Abre janelas; Abre forro; Abre aluminet")

        case num if 70 <= num < 80:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [70,80[ -> Movendo cortinas para 0% (fechada); Abre janelas; Fecha forro; Abre aluminet")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["forro"] = 1
                fuzzy_actuators["aluminet"] = 1
                if cortina:
                    fuzzy_actuators["cortina-1"] = 1
                    fuzzy_actuators["cortina-2"] = 1
                    add_context(
                        "Caso [70,80[ -> Movendo cortinas para 33%; Abre janelas; Abre forro; Abre aluminet")
                else:
                    fuzzy_actuators["cortina-1"] = 3
                    fuzzy_actuators["cortina-2"] = 3
                    add_context(
                        "Caso [70,80[ -> Movendo cortinas para 100% (aberta); Abre janelas; Abre forro; Abre aluminet")

        case num if 80 <= num <= 90:
            if state == "pre_acclimatization":
                # Ajuste temporário para, quando ativar a bomba da parede úmida em pré aclimatação, fechar as janelas
                fuzzy_actuators["janela-1"] = 0 
                fuzzy_actuators["janela-2"] = 0 
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["bomba-parede-umida"] = True
                fuzzy_actuators["exaustor-2"] = True
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [80,90[ -> Movendo cortinas para 0% (fechada); Abre janelas; Fecha forro; Abre aluminet; Liga 1 exaustor")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["bomba-parede-umida"] = True
                fuzzy_actuators["exaustor-2"] = True
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [80,90[ -> Movendo cortinas para 0% (fechada); Abre janelas; Fecha forro; Abre aluminet; Liga 1 exaustor")

        case num if 90 <= num <= 100:
            if state == "pre_acclimatization":
                # Ajuste temporário para, quando ativar a bomba da parede úmida em pré aclimatação, fechar as janelas
                fuzzy_actuators["janela-1"] = 0 
                fuzzy_actuators["janela-2"] = 0 
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["bomba-parede-umida"] = True
                fuzzy_actuators["exaustor-1"] = True
                fuzzy_actuators["exaustor-2"] = True
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [90,100[ -> Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro; Abre aluminet; Liga exaustores")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 1
                fuzzy_actuators["janela-2"] = 1
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["bomba-parede-umida"] = True
                fuzzy_actuators["exaustor-1"] = True
                fuzzy_actuators["exaustor-2"] = True
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [90,100[ -> Movendo cortinas para 0% (fechada); Abre janelas; Fecha forro; Abre aluminet; Liga exaustores")

# decisoes aquecimento


def run_hot(fuzzy_actuators, bhead, state, cortina):
    match bhead:
        case num if 20 <= num < 30:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [20,30[ -> Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro; Abre aluminet")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["aluminet"] = 1
                add_context("Caso [20,30[ -> Fecha janelas; Abre aluminet")

        case num if 30 <= num < 40:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [30,40[ -> Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro; Abre aluminet")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 1
                fuzzy_actuators["cortina-2"] = 1
                add_context(
                    "Caso [30,40[ -> Movendo cortinas para 33%; Fecha janelas, Abre aluminet")

        case num if 40 <= num < 50:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [40,50[ -> Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro; Abre aluminet")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [40,50[ -> Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro, Abre aluminet")

        case num if 50 <= num < 60:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context("Caso [50,60[ ->  Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro; Abre aluminet")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context("Caso [50,60[ -> Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro; Abre aluminet")

        case num if 60 <= num < 70:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["aquecedor-1"] = True
                fuzzy_actuators["aquecedor-2"] = True
                fuzzy_actuators["aquecedor-3"] = True
                fuzzy_actuators["aquecedor-4"] = True
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [60,70[ -> Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro; Abre aluminet; Liga os 4 aquecedores ; MAX")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["aquecedor-1"] = False
                fuzzy_actuators["aquecedor-2"] = False
                fuzzy_actuators["aquecedor-3"] = False
                fuzzy_actuators["aquecedor-4"] = False
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [60,70[ -> Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro; Abre aluminet")

        case num if 70 <= num < 80:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["aquecedor-1"] = True
                fuzzy_actuators["aquecedor-2"] = True
                fuzzy_actuators["aquecedor-3"] = True
                fuzzy_actuators["aquecedor-4"] = True
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [70,80[ -> Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro; Abre aluminet; Liga os 4 aquecedores ; MAX")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["aquecedor-1"] = False
                fuzzy_actuators["aquecedor-2"] = False
                fuzzy_actuators["aquecedor-3"] = False
                fuzzy_actuators["aquecedor-4"] = False
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [70,80[ -> Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro; Abre aluminet")

        case num if 80 <= num < 90:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["aquecedor-1"] = True
                fuzzy_actuators["aquecedor-2"] = True
                fuzzy_actuators["aquecedor-3"] = True
                fuzzy_actuators["aquecedor-4"] = True
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [80,90[ -> Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro; Abre aluminet; Liga os 4 aquecedores ; MAX")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 1
                fuzzy_actuators["aquecedor-1"] = True
                fuzzy_actuators["aquecedor-2"] = True
                fuzzy_actuators["aquecedor-3"] = True
                fuzzy_actuators["aquecedor-4"] = True
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [80,90[ -> Movendo cortinas para 0% (fechada); Fecha janelas; Fecha forro; Abre aluminet; Liga os 4 aquecedores ; MAX")

        case num if 90 <= num <= 100:
            if state == "pre_acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 0
                fuzzy_actuators["aquecedor-1"] = True
                fuzzy_actuators["aquecedor-2"] = True
                fuzzy_actuators["aquecedor-3"] = True
                fuzzy_actuators["aquecedor-4"] = True
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [90,100[ -> Fecha tudo; Liga os 4 aquecedores ; MAX")
            elif state == "acclimatization":
                fuzzy_actuators["janela-1"] = 0
                fuzzy_actuators["janela-2"] = 0
                fuzzy_actuators["forro"] = 0
                fuzzy_actuators["aluminet"] = 0
                fuzzy_actuators["aquecedor-1"] = True
                fuzzy_actuators["aquecedor-2"] = True
                fuzzy_actuators["aquecedor-3"] = True
                fuzzy_actuators["aquecedor-4"] = True
                fuzzy_actuators["cortina-1"] = 0
                fuzzy_actuators["cortina-2"] = 0
                add_context(
                    "Caso [90,100[ -> Fecha tudo; Liga os 4 aquecedores ; MAX")

    return fuzzy_actuators