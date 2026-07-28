package com.novapos.modules.shared;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

@Service
public class SampleDataService {

    private static final String TENANT_ID = "tenant-atlas-bites";
    private static final String BUSINESS_NAME = "Atlas Bites Group";

    private final List<BranchRecord> branches = List.of(
        new BranchRecord("branch-oujda", "Oujda Flagship", "OUJDA", "Africa/Casablanca"),
        new BranchRecord("branch-rabat", "Rabat Express", "RABAT", "Africa/Casablanca")
    );

    private final List<UserRecord> users = List.of(
        new UserRecord(
            "user-super-admin",
            "superadmin@novapos.ma",
            "Pass123!",
            "Nadia Platform",
            List.of("SUPER_ADMIN"),
            List.of(
                "TENANT_MANAGE",
                "BRANCH_MANAGE",
                "USER_MANAGE",
                "REPORT_VIEW",
                "SETTINGS_MANAGE",
                "POS_USE",
                "SUPPORT_ACCESS"
            ),
            List.of("branch-oujda", "branch-rabat")
        ),
        new UserRecord(
            "user-owner",
            "owner@novapos.ma",
            "Pass123!",
            "Yassine El Idrissi",
            List.of("BUSINESS_OWNER"),
            List.of(
                "TENANT_MANAGE",
                "BRANCH_MANAGE",
                "USER_MANAGE",
                "REPORT_VIEW",
                "SETTINGS_MANAGE",
                "POS_USE"
            ),
            List.of("branch-oujda", "branch-rabat")
        ),
        new UserRecord(
            "user-manager",
            "manager@novapos.ma",
            "Pass123!",
            "Sara Benhaddou",
            List.of("MANAGER"),
            List.of(
                "POS_USE",
                "REPORT_VIEW",
                "SETTINGS_MANAGE",
                "USER_VIEW",
                "BRANCH_VIEW"
            ),
            List.of("branch-oujda")
        ),
        new UserRecord(
            "user-cashier",
            "cashier@novapos.ma",
            "Pass123!",
            "Amine El Fassi",
            List.of("CASHIER"),
            List.of(
                "POS_USE",
                "PAYMENT_CREATE",
                "RECEIPT_PRINT"
            ),
            List.of("branch-oujda")
        ),
        new UserRecord(
            "user-waiter",
            "waiter@novapos.ma",
            "Pass123!",
            "Salma Waiter",
            List.of("WAITER"),
            List.of(
                "POS_USE",
                "TABLE_MANAGE",
                "KITCHEN_SEND",
                "RECEIPT_PRINT"
            ),
            List.of("branch-oujda")
        ),
        new UserRecord(
            "user-kitchen",
            "kitchen@novapos.ma",
            "Pass123!",
            "Khalid Kitchen",
            List.of("KITCHEN"),
            List.of(
                "KITCHEN_VIEW",
                "KITCHEN_UPDATE"
            ),
            List.of("branch-oujda")
        ),
        new UserRecord(
            "user-inventory",
            "inventory@novapos.ma",
            "Pass123!",
            "Imane Inventory",
            List.of("INVENTORY_MANAGER"),
            List.of(
                "INVENTORY_VIEW",
                "INVENTORY_ADJUST",
                "PURCHASING_VIEW",
                "PURCHASING_RECEIVE"
            ),
            List.of("branch-oujda", "branch-rabat")
        ),
        new UserRecord(
            "user-accountant",
            "accountant@novapos.ma",
            "Pass123!",
            "Omar Finance",
            List.of("ACCOUNTANT"),
            List.of(
                "REPORT_VIEW",
                "EXPENSE_VIEW",
                "INVOICE_VIEW",
                "PAYMENT_VIEW"
            ),
            List.of("branch-rabat")
        )
    );

    private final List<CategoryRecord> categories = List.of(
        new CategoryRecord("cat-smash-burgers", "Smash Burgers", "Burgers smash signatures"),
        new CategoryRecord("cat-burgers", "Burgers", "Burgers classiques et premium"),
        new CategoryRecord("cat-fries-drinks", "Frites & Boissons", "Accompagnements et boissons"),
        new CategoryRecord("cat-tacos", "Tacos", "Tacos gratines et recettes signature"),
        new CategoryRecord("cat-panozzos", "Panozzos", "Paninis et puccia"),
        new CategoryRecord("cat-pizza-boat", "Pizza Boat", "Pizza boat speciales"),
        new CategoryRecord("cat-pasticcio-poutine", "Pasticcio & Poutine", "Poutines et pasticcio"),
        new CategoryRecord("cat-desserts", "Desserts & Extras", "Selection rapide pour tests")
    );

    private final List<ProductRecord> products = List.of(
        new ProductRecord("prod-double-smash-bigboss", "Double Smash Bigboss", "cat-smash-burgers", new BigDecimal("65.00"), "MAD", "SMB-001", true),
        new ProductRecord("prod-smash-cheese-onion", "Smash Cheese Onion", "cat-smash-burgers", new BigDecimal("49.00"), "MAD", "SMB-002", true),
        new ProductRecord("prod-classic-smash", "Classic Smash", "cat-smash-burgers", new BigDecimal("43.00"), "MAD", "SMB-003", true),
        new ProductRecord("prod-croissant-smash-burger", "Croissant Smash Burger", "cat-smash-burgers", new BigDecimal("65.00"), "MAD", "SMB-004", true),
        new ProductRecord("prod-banana-punch", "Banana Punch", "cat-smash-burgers", new BigDecimal("53.00"), "MAD", "SMB-005", true),
        new ProductRecord("prod-el-pesto", "El Pesto", "cat-smash-burgers", new BigDecimal("50.00"), "MAD", "SMB-006", true),
        new ProductRecord("prod-pepperoni-vibe", "Pepperoni Vibe", "cat-smash-burgers", new BigDecimal("43.00"), "MAD", "SMB-007", true),

        new ProductRecord("prod-twin-guacamole", "Twin Guacamole", "cat-burgers", new BigDecimal("67.00"), "MAD", "BRG-001", true),
        new ProductRecord("prod-my-honey", "My Honey", "cat-burgers", new BigDecimal("47.00"), "MAD", "BRG-002", true),
        new ProductRecord("prod-classic-bite", "Classic Bite", "cat-burgers", new BigDecimal("43.00"), "MAD", "BRG-003", true),
        new ProductRecord("prod-special-hole-mole", "Special Hole Mole", "cat-burgers", new BigDecimal("81.00"), "MAD", "BRG-004", true),
        new ProductRecord("prod-negro-mole", "Negro Mole", "cat-burgers", new BigDecimal("55.00"), "MAD", "BRG-005", true),
        new ProductRecord("prod-nashville", "Nashville", "cat-burgers", new BigDecimal("57.00"), "MAD", "BRG-006", true),
        new ProductRecord("prod-burger-zwin", "Burger Zwin", "cat-burgers", new BigDecimal("55.00"), "MAD", "BRG-007", true),
        new ProductRecord("prod-dopamine", "Dopamine", "cat-burgers", new BigDecimal("63.00"), "MAD", "BRG-008", true),
        new ProductRecord("prod-el-jefe", "El Jefe", "cat-burgers", new BigDecimal("71.00"), "MAD", "BRG-009", true),
        new ProductRecord("prod-dont-forget", "Don't Forget!!!", "cat-burgers", new BigDecimal("95.00"), "MAD", "BRG-010", true),

        new ProductRecord("prod-frites", "Frites", "cat-fries-drinks", new BigDecimal("8.00"), "MAD", "FRD-001", true),
        new ProductRecord("prod-cheesy-fries", "Cheesy Fries", "cat-fries-drinks", new BigDecimal("16.00"), "MAD", "FRD-002", true),
        new ProductRecord("prod-jalapenos-fries", "Jalapenos Fries", "cat-fries-drinks", new BigDecimal("16.00"), "MAD", "FRD-003", true),
        new ProductRecord("prod-doritos-fries", "Doritos Fries", "cat-fries-drinks", new BigDecimal("16.00"), "MAD", "FRD-004", true),
        new ProductRecord("prod-pickles-fries", "Pickles Fries", "cat-fries-drinks", new BigDecimal("16.00"), "MAD", "FRD-005", true),
        new ProductRecord("prod-potatoes", "Potatoes", "cat-fries-drinks", new BigDecimal("10.00"), "MAD", "FRD-006", true),
        new ProductRecord("prod-cheesy-potatoes", "Cheesy Potatoes", "cat-fries-drinks", new BigDecimal("18.00"), "MAD", "FRD-007", true),
        new ProductRecord("prod-jalapenos-potatoes", "Jalapenos Potatoes", "cat-fries-drinks", new BigDecimal("18.00"), "MAD", "FRD-008", true),
        new ProductRecord("prod-doritos-potatoes", "Doritos Potatoes", "cat-fries-drinks", new BigDecimal("18.00"), "MAD", "FRD-009", true),
        new ProductRecord("prod-pickles-potatoes", "Pickles Potatoes", "cat-fries-drinks", new BigDecimal("18.00"), "MAD", "FRD-010", true),
        new ProductRecord("prod-eau-minerale", "Eau Minerale 50cl", "cat-fries-drinks", new BigDecimal("5.00"), "MAD", "FRD-011", true),
        new ProductRecord("prod-eau-gazeuse", "Eau Gazeuse", "cat-fries-drinks", new BigDecimal("7.00"), "MAD", "FRD-012", true),
        new ProductRecord("prod-boisson-gazeuse-25", "Boisson Gazeuse 25cl", "cat-fries-drinks", new BigDecimal("8.00"), "MAD", "FRD-013", true),
        new ProductRecord("prod-boisson-gazeuse-33", "Boisson Gazeuse 33cl", "cat-fries-drinks", new BigDecimal("12.00"), "MAD", "FRD-014", true),
        new ProductRecord("prod-oasis", "Oasis", "cat-fries-drinks", new BigDecimal("13.00"), "MAD", "FRD-015", true),
        new ProductRecord("prod-tymbark", "Tymbark", "cat-fries-drinks", new BigDecimal("13.00"), "MAD", "FRD-016", true),
        new ProductRecord("prod-espresso", "Espresso", "cat-fries-drinks", new BigDecimal("8.00"), "MAD", "FRD-017", true),
        new ProductRecord("prod-americain", "Americain", "cat-fries-drinks", new BigDecimal("8.00"), "MAD", "FRD-018", true),
        new ProductRecord("prod-macchiato", "Macchiato", "cat-fries-drinks", new BigDecimal("10.00"), "MAD", "FRD-019", true),
        new ProductRecord("prod-iced-spanish-latte", "Iced Spanish Latte", "cat-fries-drinks", new BigDecimal("20.00"), "MAD", "FRD-020", true),
        new ProductRecord("prod-iced-americano", "Iced Americano", "cat-fries-drinks", new BigDecimal("15.00"), "MAD", "FRD-021", true),
        new ProductRecord("prod-ice-coffe", "Ice Coffe", "cat-fries-drinks", new BigDecimal("18.00"), "MAD", "FRD-022", true),

        new ProductRecord("prod-poulet-champignons", "Poulet et Champignons", "cat-tacos", new BigDecimal("47.00"), "MAD", "TAC-001", true),
        new ProductRecord("prod-ke", "Ke'", "cat-tacos", new BigDecimal("51.00"), "MAD", "TAC-002", true),
        new ProductRecord("prod-blue", "Blue", "cat-tacos", new BigDecimal("47.00"), "MAD", "TAC-003", true),
        new ProductRecord("prod-lyonnaise", "Lyonnaise", "cat-tacos", new BigDecimal("44.00"), "MAD", "TAC-004", true),
        new ProductRecord("prod-beefos", "Beefos", "cat-tacos", new BigDecimal("45.00"), "MAD", "TAC-005", true),
        new ProductRecord("prod-hola", "Hola!", "cat-tacos", new BigDecimal("50.00"), "MAD", "TAC-006", true),
        new ProductRecord("prod-king-hole-mole", "King Hole Mole", "cat-tacos", new BigDecimal("54.00"), "MAD", "TAC-007", true),
        new ProductRecord("prod-bang-bang", "Bang Bang", "cat-tacos", new BigDecimal("47.00"), "MAD", "TAC-008", true),
        new ProductRecord("prod-hole-mexito", "Hole Mexito", "cat-tacos", new BigDecimal("49.00"), "MAD", "TAC-009", true),
        new ProductRecord("prod-mix-cheese", "Mix Cheese", "cat-tacos", new BigDecimal("53.00"), "MAD", "TAC-010", true),
        new ProductRecord("prod-pacifico", "Pacifico", "cat-tacos", new BigDecimal("75.00"), "MAD", "TAC-011", true),
        new ProductRecord("prod-mista", "Mista", "cat-tacos", new BigDecimal("51.00"), "MAD", "TAC-012", true),

        new ProductRecord("prod-amigo", "Amigo", "cat-panozzos", new BigDecimal("43.00"), "MAD", "PNZ-001", true),
        new ProductRecord("prod-indien", "Indien", "cat-panozzos", new BigDecimal("41.00"), "MAD", "PNZ-002", true),
        new ProductRecord("prod-ternera", "Ternera", "cat-panozzos", new BigDecimal("46.00"), "MAD", "PNZ-003", true),
        new ProductRecord("prod-dardar-puccia", "Dardar (Puccia)", "cat-panozzos", new BigDecimal("49.00"), "MAD", "PNZ-004", true),
        new ProductRecord("prod-tradizione-puccia", "Tradizione (Puccia)", "cat-panozzos", new BigDecimal("49.00"), "MAD", "PNZ-005", true),

        new ProductRecord("prod-pizza-boat-pepperoni", "Pizza Boat Pepperoni", "cat-pizza-boat", new BigDecimal("48.00"), "MAD", "PBT-001", true),
        new ProductRecord("prod-pizza-boat-verde", "Pizza Boat Verde", "cat-pizza-boat", new BigDecimal("45.00"), "MAD", "PBT-002", true),
        new ProductRecord("prod-pizza-boat-mediterranea", "Pizza Boat Mediterranea", "cat-pizza-boat", new BigDecimal("55.00"), "MAD", "PBT-003", true),
        new ProductRecord("prod-pizza-boat-bolognese", "Pizza Boat Bolognese", "cat-pizza-boat", new BigDecimal("49.00"), "MAD", "PBT-004", true),

        new ProductRecord("prod-diego", "Diego", "cat-pasticcio-poutine", new BigDecimal("41.00"), "MAD", "PPO-001", true),
        new ProductRecord("prod-armando", "Armando", "cat-pasticcio-poutine", new BigDecimal("37.00"), "MAD", "PPO-002", true),
        new ProductRecord("prod-maradona", "Maradona", "cat-pasticcio-poutine", new BigDecimal("39.00"), "MAD", "PPO-003", true),
        new ProductRecord("prod-scampia", "Scampia", "cat-pasticcio-poutine", new BigDecimal("42.00"), "MAD", "PPO-004", true),
        new ProductRecord("prod-quebecois", "Quebecois", "cat-pasticcio-poutine", new BigDecimal("29.00"), "MAD", "PPO-005", true),
        new ProductRecord("prod-la-elvis", "La Elvis", "cat-pasticcio-poutine", new BigDecimal("43.00"), "MAD", "PPO-006", true),
        new ProductRecord("prod-la-chicks", "La Chicks", "cat-pasticcio-poutine", new BigDecimal("45.00"), "MAD", "PPO-007", true),
        new ProductRecord("prod-smoky", "Smoky", "cat-pasticcio-poutine", new BigDecimal("42.00"), "MAD", "PPO-008", true),

        new ProductRecord("prod-caprese", "Caprese", "cat-desserts", new BigDecimal("35.00"), "MAD", "DEX-001", true),
        new ProductRecord("prod-mexicano", "Mexicano", "cat-desserts", new BigDecimal("49.00"), "MAD", "DEX-002", true),
        new ProductRecord("prod-burrata", "Burrata", "cat-desserts", new BigDecimal("65.00"), "MAD", "DEX-003", true)
    );

    private final List<PrinterRecord> printers = List.of(
        new PrinterRecord(
            "receipt-main",
            "Front Counter Receipt",
            "RECEIPT",
            "ESC_POS",
            "EPSON TM-T20II Receipt",
            80,
            42,
            "THERMAL",
            true,
            "EPSON TM-T20II Receipt"
        ),
        new PrinterRecord(
            "kitchen-hot",
            "Kitchen Hot Line",
            "KITCHEN",
            "ESC_POS",
            "EPSON TM-T20II Receipt",
            80,
            42,
            "THERMAL",
            true,
            "EPSON TM-T20II Receipt"
        )
    );

    public Optional<UserRecord> findUserByLogin(String login) {
        return users.stream()
            .filter(user -> user.email().equalsIgnoreCase(login))
            .findFirst();
    }

    public Optional<UserRecord> findUserById(String userId) {
        return users.stream()
            .filter(user -> user.id().equals(userId))
            .findFirst();
    }

    public List<UserRecord> getUsers() {
        return users;
    }

    public List<BranchRecord> getBranches() {
        return branches;
    }

    public Optional<BranchRecord> findBranch(String branchId) {
        return branches.stream()
            .filter(branch -> branch.id().equals(branchId))
            .findFirst();
    }

    public List<ProductRecord> getProducts() {
        return products;
    }

    public List<CategoryRecord> getCategories() {
        return categories;
    }

    public List<PrinterRecord> getPrinters() {
        return printers;
    }

    public DashboardRecord getDashboard(String branchId) {
        var activeOrders = "branch-rabat".equals(branchId) ? 6 : 12;
        var queueDepth = "branch-rabat".equals(branchId) ? 2 : 4;

        return new DashboardRecord(
            BUSINESS_NAME,
            branchId,
            activeOrders,
            new BigDecimal("4870.00"),
            queueDepth,
            Instant.now().toString(),
            List.of(
                "Local queue is healthy",
                "Receipt printer is online",
                "Catalog cache loaded"
            )
        );
    }

    public SessionContext sessionContext(UserRecord user) {
        var assignments = user.branchIds().stream()
            .map(this::findBranch)
            .flatMap(Optional::stream)
            .map(branch -> new BranchAssignment(
                branch.id(),
                branch.name(),
                "POS_TERMINAL"
            ))
            .toList();

        return new SessionContext(
            user.id(),
            user.displayName(),
            TENANT_ID,
            BUSINESS_NAME,
            user.roles(),
            user.permissions(),
            assignments
        );
    }

    public String nextDeviceCode(String branchId, String deviceType) {
        return "%s-%s".formatted(branchId.toUpperCase(), deviceType.toUpperCase());
    }

    public record UserRecord(
        String id,
        String email,
        String password,
        String displayName,
        List<String> roles,
        List<String> permissions,
        List<String> branchIds
    ) {}

    public record BranchRecord(String id, String name, String code, String timezone) {}

    public record CategoryRecord(String id, String name, String description) {}

    public record ProductRecord(
        String id,
        String name,
        String categoryId,
        BigDecimal price,
        String currency,
        String sku,
        boolean available
    ) {}

    public record PrinterRecord(
        String id,
        String name,
        String target,
        String protocol,
        String queueName,
        Integer paperWidthMm,
        Integer charactersPerLine,
        String printMode,
        boolean silent,
        String systemPrinterName
    ) {}

    public record DashboardRecord(
        String businessName,
        String branchId,
        int activeOrders,
        BigDecimal revenueToday,
        int queueDepth,
        String lastSuccessfulSyncAt,
        List<String> operationalNotes
    ) {}

    public record BranchAssignment(
        String branchId,
        String branchName,
        String defaultDeviceType
    ) {}

    public record SessionContext(
        String id,
        String displayName,
        String tenantId,
        String businessName,
        List<String> roles,
        List<String> permissions,
        List<BranchAssignment> branchAssignments
    ) {}
}
