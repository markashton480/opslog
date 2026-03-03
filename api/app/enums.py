from enum import Enum


class Role(str, Enum):
    admin = "admin"
    writer = "writer"
    reader = "reader"


class EventCategory(str, Enum):
    deployment = "deployment"
    config_change = "config_change"
    dns = "dns"
    service = "service"
    security = "security"
    backup = "backup"
    network = "network"
    account = "account"
    infra = "infra"
    ci = "ci"
    observation = "observation"
    other = "other"


CATEGORY_DESCRIPTIONS: dict[EventCategory, str] = {
    EventCategory.deployment: "Code deployed, promoted, or rolled back",
    EventCategory.config_change: "Server or service configuration modified",
    EventCategory.dns: "Record or nameserver changes",
    EventCategory.service: "Service start/stop/restart/reload",
    EventCategory.security: "Firewall/access/authentication changes",
    EventCategory.backup: "Backup, restore, retention activity",
    EventCategory.network: "Routing/private network changes",
    EventCategory.account: "User or agent account changes",
    EventCategory.infra: "Provisioning/rename/plan/migration work",
    EventCategory.ci: "Pipeline and runner events",
    EventCategory.observation: "Observed state with no change",
    EventCategory.other: "Uncategorised event",
}
