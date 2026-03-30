"""Utilitário para calcular próxima execução baseada em cron expression."""
from datetime import datetime, timedelta
import re


PRESETS = {
    'daily':           '0 9 * * *',    # todo dia às 9h
    'weekly_friday':   '0 21 * * 5',   # sexta às 21h
    'weekly_monday':   '0 9 * * 1',    # segunda às 9h
    'monthly':         '0 9 1 * *',    # dia 1 de cada mês às 9h
    'hourly':          '0 * * * *',    # toda hora
}


def next_run_from_cron(cron_expr: str, after: datetime = None) -> datetime | None:
    """
    Calcula a próxima execução de uma cron expression.
    Suporta o formato padrão: minuto hora dia mês dia_semana

    Implementação simples sem dependências externas.
    Para uso em produção considera usar croniter ou APScheduler.
    """
    if not cron_expr or not cron_expr.strip():
        return None

    # Resolve presets
    cron_expr = PRESETS.get(cron_expr.strip(), cron_expr.strip())

    parts = cron_expr.split()
    if len(parts) != 5:
        return None

    minute_expr, hour_expr, dom_expr, month_expr, dow_expr = parts

    def matches(value: int, expr: str) -> bool:
        if expr == '*':
            return True
        if ',' in expr:
            return value in [int(v) for v in expr.split(',')]
        if '-' in expr:
            lo, hi = expr.split('-')
            return int(lo) <= value <= int(hi)
        if '/' in expr:
            step = int(expr.split('/')[1])
            return value % step == 0
        return value == int(expr)

    now = after or datetime.utcnow()
    candidate = now.replace(second=0, microsecond=0) + timedelta(minutes=1)

    # Itera minuto a minuto até encontrar o próximo match (máx 1 ano)
    for _ in range(525960):  # minutos em 1 ano
        if (matches(candidate.month, month_expr) and
            matches(candidate.day, dom_expr) and
            matches(candidate.weekday() if dow_expr != '*' else 0,
                    dow_expr.replace('0', '0').replace('7', '0') if dow_expr != '*' else '*') and
            matches(candidate.hour, hour_expr) and
            matches(candidate.minute, minute_expr)):
            return candidate
        candidate += timedelta(minutes=1)

    return None


def format_recurrence_label(cron_expr: str) -> str:
    """Retorna label legível para a recorrência."""
    labels = {
        '0 9 * * *':   'Daily at 09:00',
        '0 21 * * 5':  'Every Friday at 21:00',
        '0 9 * * 1':   'Every Monday at 09:00',
        '0 9 1 * *':   'Monthly on the 1st',
        '0 * * * *':   'Every hour',
        'daily':         'Daily at 09:00',
        'weekly_friday': 'Every Friday at 21:00',
        'weekly_monday': 'Every Monday at 09:00',
        'monthly':       'Monthly on the 1st',
        'hourly':        'Every hour',
    }
    return labels.get(cron_expr.strip(), f'Cron: {cron_expr}')
