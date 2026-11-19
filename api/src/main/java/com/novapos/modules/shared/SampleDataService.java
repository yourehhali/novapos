package com.RoxPos.modules.shared;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

@Service
public class SampleDataService {

    private static final String TENANT_ID = "tenant-atlas-bites";
    private static final String BUSINESS_NAME = "Almani Nafris";

    private final List<BranchRecord> branches = List.of(
        new BranchRecord("branch-oujda", "Oujda Flagship", "OUJDA", "Africa/Casablanca"),
        new BranchRecord("branch-rabat", "Rabat Express", "RABAT", "Africa/Casablanca")
    );

    private final List<UserRecord> users = List.of(
        new UserRecord(
            "user-super-admin",
            "superadmin@RoxPos.ma",
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
            "owner@RoxPos.ma",
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
            "manager@RoxPos.ma",
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
            "cashier@RoxPos.ma",
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
            "waiter@RoxPos.ma",
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
            "kitchen@RoxPos.ma",
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
            "inventory@RoxPos.ma",
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
            "accountant@RoxPos.ma",
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
        new CategoryRecord("cat-menus", "MENU", "Menu formulas"),
        new CategoryRecord("cat-sandwiches", "SANDWICHES", "Sandwiches"),
        new CategoryRecord("cat-sides", "SIDES", "Side dishes"),
        new CategoryRecord("cat-salads", "SALADS", "Salads"),
        new CategoryRecord("cat-drinks", "DRINKS", "Cold and hot drinks")
    );

    private final List<ProductRecord> products = List.of(
        new ProductRecord("prod-saucisse-almani-menu-1", "Saucisse Almani Menu #1", "cat-menus", new BigDecimal("39.00"), "DH", "MEN-001", true),
        new ProductRecord("prod-nafri-burger-menu-2", "Nafri Burger Menu #2", "cat-menus", new BigDecimal("45.00"), "DH", "MEN-002", true),
        new ProductRecord("prod-schnitzel-menu-3", "Schnitzel Menu #3", "cat-menus", new BigDecimal("59.00"), "DH", "MEN-003", true),

        new ProductRecord("prod-saucisse-almani-4", "Saucisse Almani #4", "cat-sandwiches", new BigDecimal("25.00"), "DH", "SAN-001", true),
        new ProductRecord("prod-nafris-burger-5", "Nafris Burger #5", "cat-sandwiches", new BigDecimal("29.00"), "DH", "SAN-002", true),
        new ProductRecord("prod-schnitzel-6", "Schnitzel #6", "cat-sandwiches", new BigDecimal("39.00"), "DH", "SAN-003", true),

        new ProductRecord("prod-french-fries-7", "French fries #7", "cat-sides", new BigDecimal("7.00"), "DH", "SID-001", true),

        new ProductRecord("prod-salad-8", "Salad #8", "cat-salads", new BigDecimal("7.00"), "DH", "SAL-001", true),
        new ProductRecord("prod-fruit-salad-9", "Fruit salad #9", "cat-salads", new BigDecimal("25.00"), "DH", "SAL-002", true),

        new ProductRecord("prod-nafri-drink-10", "Nafri drink #10", "cat-drinks", new BigDecimal("12.00"), "DH", "DRK-001", true)
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
