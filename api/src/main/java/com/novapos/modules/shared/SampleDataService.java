package com.novapos.modules.shared;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

@Service
public class SampleDataService {

    private static final String TENANT_ID = "tenant-atlas-bites";
    private static final String BUSINESS_NAME = "Hole Mole";

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
        new CategoryRecord("cat-burgers", "BURGERS", "Hole Mole burgers"),
        new CategoryRecord("cat-smash-burgers", "SMASH BURGERS", "Hole Mole smash burgers"),
        new CategoryRecord("cat-pasticcio", "PASTICCIO", "Pasticcio selection"),
        new CategoryRecord("cat-poutine", "POUTINE", "Poutine selection"),
        new CategoryRecord("cat-panozzos", "PANOZZOS", "Panozzos selection"),
        new CategoryRecord("cat-pizza-boat", "PIZZA BOAT", "Pizza boat selection"),
        new CategoryRecord("cat-tacos", "TACOS", "Tacos selection"),
        new CategoryRecord("cat-fries", "FRIES", "Fries and potatoes"),
        new CategoryRecord("cat-drinks", "DRINKS", "Cold and hot drinks"),
        new CategoryRecord("cat-tapas", "TAPAS", "Tapas selection"),
        new CategoryRecord("cat-salades", "SALADES", "Salad selection"),
        new CategoryRecord("cat-extras", "EXTRAS", "Extras and add-ons"),
        new CategoryRecord("cat-glovo", "GLOVO", "Glovo menu items")
    );

    private final List<ProductRecord> products = List.of(
        new ProductRecord("prod-twin-guacamole", "TWIN GUACAMOLE", "cat-burgers", new BigDecimal("67.00"), "DH", "BRG-001", true),
        new ProductRecord("prod-my-honey", "MY HONEY", "cat-burgers", new BigDecimal("47.00"), "DH", "BRG-002", true),
        new ProductRecord("prod-classic-bite", "CLASSIC BITE", "cat-burgers", new BigDecimal("43.00"), "DH", "BRG-003", true),
        new ProductRecord("prod-special-hole-mole", "SPECIAL HOLÉ MOLÉ", "cat-burgers", new BigDecimal("81.00"), "DH", "BRG-004", true),
        new ProductRecord("prod-negro-mole", "NEGRO MOLÉ", "cat-burgers", new BigDecimal("65.00"), "DH", "BRG-005", true),
        new ProductRecord("prod-nashville", "NASHVILLE", "cat-burgers", new BigDecimal("57.00"), "DH", "BRG-006", true),
        new ProductRecord("prod-burger-zwin", "BURGER ZWIN", "cat-burgers", new BigDecimal("55.00"), "DH", "BRG-007", true),
        new ProductRecord("prod-dopamine", "DOPAMINE", "cat-burgers", new BigDecimal("63.00"), "DH", "BRG-008", true),
        new ProductRecord("prod-el-jefe", "EL JEFE", "cat-burgers", new BigDecimal("71.00"), "DH", "BRG-009", true),
        new ProductRecord("prod-dont-forget", "DON’T FORGET", "cat-burgers", new BigDecimal("95.00"), "DH", "BRG-010", true),

        new ProductRecord("prod-double-smash-big-boss", "DOUBLE SMASH BIG BOSS", "cat-smash-burgers", new BigDecimal("65.00"), "DH", "SMB-001", true),
        new ProductRecord("prod-smash-cheese-onion", "SMASH CHEESE ONION", "cat-smash-burgers", new BigDecimal("49.00"), "DH", "SMB-002", true),
        new ProductRecord("prod-classic-smash", "CLASSIC SMASH", "cat-smash-burgers", new BigDecimal("43.00"), "DH", "SMB-003", true),
        new ProductRecord("prod-croissant-smash-burger", "CROISSANT SMASH BURGER", "cat-smash-burgers", new BigDecimal("65.00"), "DH", "SMB-004", true),
        new ProductRecord("prod-banana-punch", "BANANA PUNCH", "cat-smash-burgers", new BigDecimal("53.00"), "DH", "SMB-005", true),
        new ProductRecord("prod-el-pesto", "EL PESTO", "cat-smash-burgers", new BigDecimal("50.00"), "DH", "SMB-006", true),
        new ProductRecord("prod-peperroni-vibe", "PEPERRONI VIBE", "cat-smash-burgers", new BigDecimal("57.00"), "DH", "SMB-007", true),

        new ProductRecord("prod-diego", "DIEGO", "cat-pasticcio", new BigDecimal("41.00"), "DH", "PAS-001", true),
        new ProductRecord("prod-armando", "ARMANDO", "cat-pasticcio", new BigDecimal("37.00"), "DH", "PAS-002", true),
        new ProductRecord("prod-maradona", "MARADONA", "cat-pasticcio", new BigDecimal("39.00"), "DH", "PAS-003", true),
        new ProductRecord("prod-scampia", "SCAMPIA", "cat-pasticcio", new BigDecimal("42.00"), "DH", "PAS-004", true),

        new ProductRecord("prod-quebecois", "QUEBECOIS", "cat-poutine", new BigDecimal("29.00"), "DH", "POU-001", true),
        new ProductRecord("prod-la-elvis", "LA ELVIS", "cat-poutine", new BigDecimal("43.00"), "DH", "POU-002", true),
        new ProductRecord("prod-la-chicks", "LA CHICKS", "cat-poutine", new BigDecimal("45.00"), "DH", "POU-003", true),
        new ProductRecord("prod-smoky", "SMOKY", "cat-poutine", new BigDecimal("42.00"), "DH", "POU-004", true),

        new ProductRecord("prod-amigo", "AMIGO", "cat-panozzos", new BigDecimal("43.00"), "DH", "PNZ-001", true),
        new ProductRecord("prod-indien", "INDIEN", "cat-panozzos", new BigDecimal("41.00"), "DH", "PNZ-002", true),
        new ProductRecord("prod-ternera", "TERNERA", "cat-panozzos", new BigDecimal("46.00"), "DH", "PNZ-003", true),
        new ProductRecord("prod-bang-bang-panozzo", "BANG BANG", "cat-panozzos", new BigDecimal("47.00"), "DH", "PNZ-004", true),
        new ProductRecord("prod-mix-cheese-panozzo", "MIX CHEESE", "cat-panozzos", new BigDecimal("53.00"), "DH", "PNZ-005", true),
        new ProductRecord("prod-pacifico", "PACIFICO", "cat-panozzos", new BigDecimal("75.00"), "DH", "PNZ-006", true),
        new ProductRecord("prod-mista", "MISTA", "cat-panozzos", new BigDecimal("51.00"), "DH", "PNZ-007", true),
        new ProductRecord("prod-dardar", "DARDAR", "cat-panozzos", new BigDecimal("49.00"), "DH", "PNZ-008", true),
        new ProductRecord("prod-tradizione", "TRADIZIONE", "cat-panozzos", new BigDecimal("49.00"), "DH", "PNZ-009", true),

        new ProductRecord("prod-pepperoni", "PEPPERONI", "cat-pizza-boat", new BigDecimal("48.00"), "DH", "PBT-001", true),
        new ProductRecord("prod-verde", "VERDE", "cat-pizza-boat", new BigDecimal("45.00"), "DH", "PBT-002", true),
        new ProductRecord("prod-mediterranea", "MEDITERRANEA", "cat-pizza-boat", new BigDecimal("55.00"), "DH", "PBT-003", true),
        new ProductRecord("prod-bolognese", "BOLOGNESE", "cat-pizza-boat", new BigDecimal("49.00"), "DH", "PBT-004", true),

        new ProductRecord("prod-poulet-et-champignons", "POULET ET CHAMPIGNONS", "cat-tacos", new BigDecimal("47.00"), "DH", "TAC-001", true),
        new ProductRecord("prod-blue", "BLUE", "cat-tacos", new BigDecimal("47.00"), "DH", "TAC-002", true),
        new ProductRecord("prod-beefos", "BEEFOS", "cat-tacos", new BigDecimal("45.00"), "DH", "TAC-003", true),
        new ProductRecord("prod-king-hole-mole", "KING HOLÉ MOLÉ", "cat-tacos", new BigDecimal("54.00"), "DH", "TAC-004", true),
        new ProductRecord("prod-hole-mexito", "HOLÉ MEXITO", "cat-tacos", new BigDecimal("49.00"), "DH", "TAC-005", true),
        new ProductRecord("prod-ke", "KE", "cat-tacos", new BigDecimal("51.00"), "DH", "TAC-006", true),
        new ProductRecord("prod-lyonnaise", "LYONNAISE", "cat-tacos", new BigDecimal("44.00"), "DH", "TAC-007", true),
        new ProductRecord("prod-hola", "HOLA!", "cat-tacos", new BigDecimal("50.00"), "DH", "TAC-008", true),

        new ProductRecord("prod-frites", "FRITES", "cat-fries", new BigDecimal("8.00"), "DH", "FRI-001", true),
        new ProductRecord("prod-cheesy-fries", "CHEESY FRIES", "cat-fries", new BigDecimal("16.00"), "DH", "FRI-002", true),
        new ProductRecord("prod-jalapenos-fries", "JALAPENOS FRIES", "cat-fries", new BigDecimal("16.00"), "DH", "FRI-003", true),
        new ProductRecord("prod-doritos-fries", "DORITOS FRIES", "cat-fries", new BigDecimal("16.00"), "DH", "FRI-004", true),
        new ProductRecord("prod-pickles-fries", "PICKLES FRIES", "cat-fries", new BigDecimal("16.00"), "DH", "FRI-005", true),
        new ProductRecord("prod-potatoes", "POTATOES", "cat-fries", new BigDecimal("10.00"), "DH", "FRI-006", true),
        new ProductRecord("prod-cheesy-potatoes", "CHEESY POTATOES", "cat-fries", new BigDecimal("18.00"), "DH", "FRI-007", true),
        new ProductRecord("prod-jalapenos-potates", "JALAPENOS POTATES", "cat-fries", new BigDecimal("18.00"), "DH", "FRI-008", true),
        new ProductRecord("prod-doritos-potates", "DORITOS POTATES", "cat-fries", new BigDecimal("18.00"), "DH", "FRI-009", true),
        new ProductRecord("prod-pickles-potates", "PICKLES POTATES", "cat-fries", new BigDecimal("18.00"), "DH", "FRI-010", true),
        new ProductRecord("prod-mole-fries", "MOLE FRIES", "cat-fries", new BigDecimal("25.00"), "DH", "FRI-011", true),
        new ProductRecord("prod-guacamole-fries", "GUACAMOLE FRIES", "cat-fries", new BigDecimal("23.00"), "DH", "FRI-012", true),
        new ProductRecord("prod-mexicano-fries", "MEXICANO FRIES", "cat-fries", new BigDecimal("35.00"), "DH", "FRI-013", true),

        new ProductRecord("prod-eau-minerale-50cl", "EAU MINERALE 50CL", "cat-drinks", new BigDecimal("5.00"), "DH", "DRK-001", true),
        new ProductRecord("prod-eau-gazeuse", "EAU GAZEUSE", "cat-drinks", new BigDecimal("7.00"), "DH", "DRK-002", true),
        new ProductRecord("prod-boisson-gazeuse-25cl", "BOISSON GAZEUSE 25CL", "cat-drinks", new BigDecimal("8.00"), "DH", "DRK-003", true),
        new ProductRecord("prod-boisson-gazeuse-33cl", "BOISSON GAZEUSE 33CL", "cat-drinks", new BigDecimal("12.00"), "DH", "DRK-004", true),
        new ProductRecord("prod-oasis", "OASIS", "cat-drinks", new BigDecimal("13.00"), "DH", "DRK-005", true),
        new ProductRecord("prod-tymbark", "TYMBARK", "cat-drinks", new BigDecimal("13.00"), "DH", "DRK-006", true),
        new ProductRecord("prod-espresso", "ESPRESSO", "cat-drinks", new BigDecimal("8.00"), "DH", "DRK-007", true),
        new ProductRecord("prod-americain", "AMERICAIN", "cat-drinks", new BigDecimal("8.00"), "DH", "DRK-008", true),
        new ProductRecord("prod-macchiato", "MACCHIATO", "cat-drinks", new BigDecimal("10.00"), "DH", "DRK-009", true),
        new ProductRecord("prod-iced-spanish-latte", "ICED SPANISH LATTE", "cat-drinks", new BigDecimal("20.00"), "DH", "DRK-010", true),
        new ProductRecord("prod-iced-americano", "ICED AMERICANO", "cat-drinks", new BigDecimal("15.00"), "DH", "DRK-011", true),
        new ProductRecord("prod-ice-coffe", "ICE COFFE", "cat-drinks", new BigDecimal("18.00"), "DH", "DRK-012", true),

        new ProductRecord("prod-guacamole-con-nachos", "GUACAMOLE CON NACHOS", "cat-tapas", new BigDecimal("25.00"), "DH", "TAP-001", true),
        new ProductRecord("prod-honey-crusted-chicken", "HONEY CRUSTED CHICKEN", "cat-tapas", new BigDecimal("37.00"), "DH", "TAP-002", true),

        new ProductRecord("prod-capresse", "CAPRESSE", "cat-salades", new BigDecimal("53.00"), "DH", "SAL-001", true),
        new ProductRecord("prod-mexicano-salade", "MEXICANO", "cat-salades", new BigDecimal("49.00"), "DH", "SAL-002", true),
        new ProductRecord("prod-burrata", "BURRATA", "cat-salades", new BigDecimal("65.00"), "DH", "SAL-003", true),

        new ProductRecord("prod-sauce-holemole", "SAUCE HOLEMOLE", "cat-extras", new BigDecimal("5.00"), "DH", "EXT-001", true),
        new ProductRecord("prod-sauce-nawhals", "SAUCE NAWHALS", "cat-extras", new BigDecimal("2.00"), "DH", "EXT-002", true),
        new ProductRecord("prod-steak-vh", "STEAK VH", "cat-extras", new BigDecimal("20.00"), "DH", "EXT-003", true),
        new ProductRecord("prod-steak-smash", "STEAK SMASH", "cat-extras", new BigDecimal("10.00"), "DH", "EXT-004", true),
        new ProductRecord("prod-crusted-chicken", "CRUSTED CHICKEN", "cat-extras", new BigDecimal("18.00"), "DH", "EXT-005", true),
        new ProductRecord("prod-fromage", "FROMAGE", "cat-extras", new BigDecimal("8.00"), "DH", "EXT-006", true),

        new ProductRecord("prod-glovo", "GLOVO", "cat-glovo", new BigDecimal("0.00"), "DH", "GLV-001", true),
        new ProductRecord("prod-combo-t", "COMBO T", "cat-glovo", new BigDecimal("131.00"), "DH", "GLV-002", true),
        new ProductRecord("prod-combo-h", "COMBO H", "cat-glovo", new BigDecimal("72.00"), "DH", "GLV-003", true),
        new ProductRecord("prod-combo-s", "COMBO S", "cat-glovo", new BigDecimal("134.00"), "DH", "GLV-004", true),
        new ProductRecord("prod-combo-b", "COMBO B", "cat-glovo", new BigDecimal("141.00"), "DH", "GLV-005", true),
        new ProductRecord("prod-combo-m", "COMBO M", "cat-glovo", new BigDecimal("142.00"), "DH", "GLV-006", true)
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
