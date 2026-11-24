"""
Regras da lógica Fuzzy

"""

import numpy as np
from skfuzzy import control as ctrl
import skfuzzy as fuzzy

from apian.database import db
from apian.apps.errors.exceptions import DocumentNotFound
from apian.logger import fuzzy_logger


def set_rules():

    wind = ctrl.Antecedent(np.arange(0, 100, 1), 'wind')
    te = ctrl.Antecedent(np.arange(0, 50, 1), 'te')
    ti = ctrl.Antecedent(np.arange(0, 50, 1), 'ti')
    ate = ctrl.Antecedent(np.arange(0, 50, 1), 'ate')
    ati = ctrl.Antecedent(np.arange(0, 50, 1), 'ati')
    ref = ctrl.Consequent(np.arange(0, 100, 1), 'ref')
    hea = ctrl.Consequent(np.arange(0, 100, 1), 'hea')

    # wind
    wind['slow'] = fuzzy.trapmf(wind.universe, [-1000, 3, 7, 11])
    wind['moderate'] = fuzzy.trimf(wind.universe, [10, 25, 28])
    wind['fast'] = fuzzy.trapmf(wind.universe, [27, 30, 35, 100])

    # parametros (pega o setpoint do banco de dados)

    config_doc = db().config.find_one({"_id": "hardware"})
    temp_var = "temp"
    if "use_temp_plant" in config_doc and config_doc["use_temp_plant"]:
        temp_var = "temp_plant"

    temp_doc = db().groups.find_one({"_id": temp_var})

    if not temp_doc:
        raise DocumentNotFound([temp_var])

    if not "data" in temp_doc or not "set_point" in temp_doc["data"] or not "pre_set_point" in temp_doc["data"]:
        raise ValueError(
            "Chave 'set_point' ou 'pre_set_point' não encontrada no documento")

    pre_set_point = temp_doc["data"]["pre_set_point"]
    set_point = temp_doc["data"]["set_point"]

    fuzzy_logger.info(f"Recriando regras da fuzzy...")
    fuzzy_logger.info(
        f"Usando parâmetro de temperatura. set_point: {set_point}, pre_set_point: {pre_set_point}")

    # temp ext
    te['vcold'] = fuzzy.trapmf(te.universe, [-1000, 5, 10, 15])
    te['cold'] = fuzzy.trimf(te.universe, [14, 18, 20])
    te['warm'] = fuzzy.trimf(te.universe, [19, 21, 23])
    te['good'] = fuzzy.trimf(te.universe, [22, 25, 27])
    te['hot'] = fuzzy.trapmf(te.universe, [26, 35, 50, 1000])

    # temp int
    ti['vcold'] = fuzzy.trapmf(
        te.universe, [-1000, 5-(25-pre_set_point), 10-(25-pre_set_point), 15-(25-pre_set_point)])
    ti['cold'] = fuzzy.trimf(
        te.universe, [14-(25-pre_set_point), 18-(25-pre_set_point), 20-(25-pre_set_point)])
    ti['warm'] = fuzzy.trimf(
        te.universe, [19-(25-pre_set_point), 21-(25-pre_set_point), 23-(25-pre_set_point)])
    ti['good'] = fuzzy.trimf(
        te.universe, [22-(25-pre_set_point), 25-(25-pre_set_point), 27-(25-pre_set_point)])
    ti['hot'] = fuzzy.trapmf(
        te.universe, [26-(25-pre_set_point), 35-(25-pre_set_point), 50-(25-pre_set_point), 1000])

    # temp ext acli
    ate['vcold'] = fuzzy.trapmf(ate.universe, [-1000, 5, 10, 15])
    ate['cold'] = fuzzy.trimf(ate.universe, [14, 18, 20])
    ate['warm'] = fuzzy.trimf(ate.universe, [19, 22, 26])
    ate['good'] = fuzzy.trimf(ate.universe, [25, 28, 30])
    ate['hot'] = fuzzy.trapmf(ate.universe, [29, 35, 50, 1000])

    # temp int acli
    ati['vcold'] = fuzzy.trapmf(
        ate.universe, [-1000, 5-(28-set_point), 10-(28-set_point), 15-(28-set_point)])
    ati['cold'] = fuzzy.trimf(
        ate.universe, [14-(28-set_point), 18-(28-set_point), 20-(28-set_point)])
    ati['warm'] = fuzzy.trimf(
        ate.universe, [19-(28-set_point), 22-(28-set_point), 26-(28-set_point)])
    ati['good'] = fuzzy.trimf(
        ate.universe, [25-(28-set_point), 28-(28-set_point), 30-(28-set_point)])
    ati['hot'] = fuzzy.trapmf(
        ate.universe, [29-(28-set_point), 35-(28-set_point), 50-(28-set_point), 1000])

    # refrigeração
    ref['00'] = fuzzy.trimf(ref.universe, [0, 0, 0])
    ref['10'] = fuzzy.trimf(ref.universe, [0, 5, 10])
    ref['20'] = fuzzy.trimf(ref.universe, [9, 15, 20])
    ref['30'] = fuzzy.trimf(ref.universe, [19, 25, 30])
    ref['40'] = fuzzy.trimf(ref.universe, [29, 35, 40])
    ref['50'] = fuzzy.trimf(ref.universe, [39, 45, 50])
    ref['60'] = fuzzy.trimf(ref.universe, [49, 55, 60])
    ref['70'] = fuzzy.trimf(ref.universe, [59, 65, 70])
    ref['80'] = fuzzy.trimf(ref.universe, [69, 75, 80])
    ref['90'] = fuzzy.trimf(ref.universe, [79, 85, 90])
    ref['100'] = fuzzy.trimf(ref.universe, [89, 95, 100])

    # aquecimento
    hea['00'] = fuzzy.trimf(hea.universe, [0, 0, 0])
    hea['10'] = fuzzy.trimf(hea.universe, [0,  5, 10])
    hea['20'] = fuzzy.trimf(hea.universe, [9, 15, 20])
    hea['30'] = fuzzy.trimf(hea.universe, [19, 25, 30])
    hea['40'] = fuzzy.trimf(hea.universe, [29, 35, 40])
    hea['50'] = fuzzy.trimf(hea.universe, [39, 45, 50])
    hea['60'] = fuzzy.trimf(hea.universe, [49, 55, 60])
    hea['70'] = fuzzy.trimf(hea.universe, [59, 65, 70])
    hea['80'] = fuzzy.trimf(hea.universe, [69, 75, 80])
    hea['90'] = fuzzy.trimf(hea.universe, [79, 85, 90])
    hea['100'] = fuzzy.trimf(hea.universe, [89, 95, 100])

    # Rules for preAclimatacao

    pre_acclimatization_rules = []

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['vcold'] & ti['vcold']), consequent=(ref['00'], hea['100'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['vcold'] & ti['cold']), consequent=(ref['00'], hea['90'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['vcold'] & ti['warm']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['vcold'] & ti['good']), consequent=(ref['00'], hea['50'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['vcold'] & ti['hot']), consequent=(ref['30'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['cold'] & ti['vcold']), consequent=(ref['00'], hea['100'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['cold'] & ti['cold']), consequent=(ref['00'], hea['80'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['cold'] & ti['warm']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['cold'] & ti['good']), consequent=(ref['00'], hea['40'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['cold'] & ti['hot']), consequent=(ref['40'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['warm'] & ti['vcold']), consequent=(ref['00'], hea['80'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['warm'] & ti['cold']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['warm'] & ti['warm']), consequent=(ref['00'], hea['50'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['warm'] & ti['good']), consequent=(ref['00'], hea['40'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['warm'] & ti['hot']), consequent=(ref['70'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['good'] & ti['vcold']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['good'] & ti['cold']), consequent=(ref['00'], hea['60'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['good'] & ti['warm']), consequent=(ref['00'], hea['30'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['good'] & ti['good']), consequent=(ref['20'], hea['00'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['good'] & ti['hot']), consequent=(ref['70'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['hot'] & ti['vcold']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['hot'] & ti['cold']), consequent=(ref['00'], hea['50'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['hot'] & ti['warm']), consequent=(ref['00'], hea['00'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['hot'] & ti['good']), consequent=(ref['70'], hea['00'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & te['hot'] & ti['hot']), consequent=(ref['100'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['vcold'] & ti['vcold']), consequent=(ref['00'], hea['100'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['vcold'] & ti['cold']), consequent=(ref['00'], hea['90'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['vcold'] & ti['warm']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['vcold'] & ti['good']), consequent=(ref['00'], hea['40'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['vcold'] & ti['hot']), consequent=(ref['30'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['cold'] & ti['vcold']), consequent=(ref['00'], hea['100'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['cold'] & ti['cold']), consequent=(ref['00'], hea['80'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['cold'] & ti['warm']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['cold'] & ti['good']), consequent=(ref['00'], hea['50'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['cold'] & ti['hot']), consequent=(ref['40'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['warm'] & ti['vcold']), consequent=(ref['00'], hea['80'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['warm'] & ti['cold']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['warm'] & ti['warm']), consequent=(ref['00'], hea['50'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['warm'] & ti['good']), consequent=(ref['00'], hea['40'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['warm'] & ti['hot']), consequent=(ref['70'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['good'] & ti['vcold']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['good'] & ti['cold']), consequent=(ref['00'], hea['60'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['good'] & ti['warm']), consequent=(ref['00'], hea['30'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['good'] & ti['good']), consequent=(ref['30'], hea['00'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['good'] & ti['hot']), consequent=(ref['70'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['hot'] & ti['vcold']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['hot'] & ti['cold']), consequent=(ref['00'], hea['50'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['hot'] & ti['warm']), consequent=(ref['30'], hea['00'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['hot'] & ti['good']), consequent=(ref['70'], hea['00'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & te['hot'] & ti['hot']), consequent=(ref['100'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['vcold'] & ti['vcold']), consequent=(ref['00'], hea['100'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['vcold'] & ti['cold']), consequent=(ref['00'], hea['90'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['vcold'] & ti['warm']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['vcold'] & ti['good']), consequent=(ref['00'], hea['40'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['vcold'] & ti['hot']), consequent=(ref['30'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['cold'] & ti['vcold']), consequent=(ref['00'], hea['100'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['cold'] & ti['cold']), consequent=(ref['00'], hea['80'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['cold'] & ti['warm']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['cold'] & ti['good']), consequent=(ref['00'], hea['50'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['cold'] & ti['hot']), consequent=(ref['30'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['warm'] & ti['vcold']), consequent=(ref['00'], hea['80'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['warm'] & ti['cold']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['warm'] & ti['warm']), consequent=(ref['00'], hea['50'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['warm'] & ti['good']), consequent=(ref['00'], hea['30'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['warm'] & ti['hot']), consequent=(ref['70'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['good'] & ti['vcold']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['good'] & ti['cold']), consequent=(ref['00'], hea['60'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['good'] & ti['warm']), consequent=(ref['00'], hea['30'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['good'] & ti['good']), consequent=(ref['40'], hea['00'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['good'] & ti['hot']), consequent=(ref['80'], hea['00'])))

    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['hot'] & ti['vcold']), consequent=(ref['00'], hea['70'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['hot'] & ti['cold']), consequent=(ref['00'], hea['50'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['hot'] & ti['warm']), consequent=(ref['40'], hea['00'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['hot'] & ti['good']), consequent=(ref['70'], hea['00'])))
    pre_acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & te['hot'] & ti['hot']), consequent=(ref['100'], hea['00'])))

    # Rules for aclimatacao

    acclimatization_rules = []

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['vcold'] & ati['vcold']), consequent=(ref['00'], hea['100'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['vcold'] & ati['cold']), consequent=(ref['00'], hea['90'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['vcold'] & ati['warm']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['vcold'] & ati['good']), consequent=(ref['00'], hea['50'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['vcold'] & ati['hot']), consequent=(ref['30'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['cold'] & ati['vcold']), consequent=(ref['00'], hea['100'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['cold'] & ati['cold']), consequent=(ref['00'], hea['80'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['cold'] & ati['warm']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['cold'] & ati['good']), consequent=(ref['00'], hea['40'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['cold'] & ati['hot']), consequent=(ref['30'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['warm'] & ati['vcold']), consequent=(ref['00'], hea['80'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['warm'] & ati['cold']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['warm'] & ati['warm']), consequent=(ref['00'], hea['50'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['warm'] & ati['good']), consequent=(ref['00'], hea['40'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['warm'] & ati['hot']), consequent=(ref['60'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['good'] & ati['vcold']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['good'] & ati['cold']), consequent=(ref['00'], hea['60'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['good'] & ati['warm']), consequent=(ref['00'], hea['30'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['good'] & ati['good']), consequent=(ref['20'], hea['00'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['good'] & ati['hot']), consequent=(ref['60'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['hot'] & ati['vcold']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['hot'] & ati['cold']), consequent=(ref['00'], hea['50'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['hot'] & ati['warm']), consequent=(ref['00'], hea['00'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['hot'] & ati['good']), consequent=(ref['70'], hea['00'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['slow'] & ate['hot'] & ati['hot']), consequent=(ref['100'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['vcold'] & ati['vcold']), consequent=(ref['00'], hea['100'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['vcold'] & ati['cold']), consequent=(ref['00'], hea['90'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['vcold'] & ati['warm']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['vcold'] & ati['good']), consequent=(ref['00'], hea['40'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['vcold'] & ati['hot']), consequent=(ref['30'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['cold'] & ati['vcold']), consequent=(ref['00'], hea['100'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['cold'] & ati['cold']), consequent=(ref['00'], hea['80'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['cold'] & ati['warm']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['cold'] & ati['good']), consequent=(ref['00'], hea['50'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['cold'] & ati['hot']), consequent=(ref['40'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['warm'] & ati['vcold']), consequent=(ref['00'], hea['80'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['warm'] & ati['cold']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['warm'] & ati['warm']), consequent=(ref['00'], hea['50'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['warm'] & ati['good']), consequent=(ref['00'], hea['40'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['warm'] & ati['hot']), consequent=(ref['70'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['good'] & ati['vcold']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['good'] & ati['cold']), consequent=(ref['00'], hea['60'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['good'] & ati['warm']), consequent=(ref['00'], hea['30'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['good'] & ati['good']), consequent=(ref['30'], hea['00'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['good'] & ati['hot']), consequent=(ref['70'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['hot'] & ati['vcold']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['hot'] & ati['cold']), consequent=(ref['00'], hea['50'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['hot'] & ati['warm']), consequent=(ref['30'], hea['00'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['hot'] & ati['good']), consequent=(ref['70'], hea['00'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['moderate'] & ate['hot'] & ati['hot']), consequent=(ref['100'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['vcold'] & ati['vcold']), consequent=(ref['00'], hea['100'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['vcold'] & ati['cold']), consequent=(ref['00'], hea['90'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['vcold'] & ati['warm']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['vcold'] & ati['good']), consequent=(ref['00'], hea['40'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['vcold'] & ati['hot']), consequent=(ref['30'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['cold'] & ati['vcold']), consequent=(ref['00'], hea['100'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['cold'] & ati['cold']), consequent=(ref['00'], hea['80'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['cold'] & ati['warm']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['cold'] & ati['good']), consequent=(ref['00'], hea['50'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['cold'] & ati['hot']), consequent=(ref['30'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['warm'] & ati['vcold']), consequent=(ref['00'], hea['80'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['warm'] & ati['cold']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['warm'] & ati['warm']), consequent=(ref['00'], hea['50'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['warm'] & ati['good']), consequent=(ref['00'], hea['30'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['warm'] & ati['hot']), consequent=(ref['70'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['good'] & ati['vcold']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['good'] & ati['cold']), consequent=(ref['00'], hea['60'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['good'] & ati['warm']), consequent=(ref['00'], hea['30'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['good'] & ati['good']), consequent=(ref['40'], hea['00'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['good'] & ati['hot']), consequent=(ref['80'], hea['00'])))

    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['hot'] & ati['vcold']), consequent=(ref['00'], hea['70'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['hot'] & ati['cold']), consequent=(ref['00'], hea['50'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['hot'] & ati['warm']), consequent=(ref['40'], hea['00'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['hot'] & ati['good']), consequent=(ref['70'], hea['00'])))
    acclimatization_rules.append(ctrl.Rule(antecedent=(
        wind['fast'] & ate['hot'] & ati['hot']), consequent=(ref['100'], hea['00'])))

    return (pre_acclimatization_rules, acclimatization_rules)


def get_rule(state):
    pc = None
    fis = None
    rules = set_rules()

    fuzzy_logger.info(f"Definindo regras da fuzzy... State: {state}")

    if (state == "pre_acclimatization"):
        pc = ctrl.ControlSystem(rules[0])
        fis = ctrl.ControlSystemSimulation(pc)

    elif (state == "acclimatization"):
        pc = ctrl.ControlSystem(rules[1])
        fis = ctrl.ControlSystemSimulation(pc)

    else:
        raise ValueError("Nenhum estado válido")

    return fis