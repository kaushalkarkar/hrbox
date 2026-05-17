package com.hrms.bootstrap;

import com.hrms.domain.*;
import com.hrms.leave.LeaveBalanceService;
import com.hrms.repo.DepartmentRepository;
import com.hrms.repo.EmployeeRepository;
import com.hrms.repo.SalaryStructureRepository;
import com.hrms.repo.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * One-shot bulk seed for an IT-company demo: 500 employees across 10
 * engineering / support departments with realistic Indian names,
 * graded designations, manager hierarchy and salary structures.
 *
 * Runs only when the employee count is &lt; 50 (i.e. the only "seed"
 * employees from {@link DataSeeder} exist). Safe to redeploy.
 */
@Component
@Order(100)
public class BulkEmployeeSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(BulkEmployeeSeeder.class);

    private static final int TARGET = 500;

    private final EmployeeRepository employees;
    private final DepartmentRepository departments;
    private final UserAccountRepository users;
    private final SalaryStructureRepository salaryStructures;
    private final LeaveBalanceService balances;
    private final PasswordEncoder encoder;

    public BulkEmployeeSeeder(EmployeeRepository employees,
                              DepartmentRepository departments,
                              UserAccountRepository users,
                              SalaryStructureRepository salaryStructures,
                              LeaveBalanceService balances,
                              PasswordEncoder encoder) {
        this.employees = employees;
        this.departments = departments;
        this.users = users;
        this.salaryStructures = salaryStructures;
        this.balances = balances;
        this.encoder = encoder;
    }

    /* ===== Source data ===== */

    private static final String[] FIRST_NAMES_M = {
            "Aarav", "Aditya", "Akash", "Amit", "Anand", "Arjun", "Aryan", "Ashish", "Bhavesh", "Chirag",
            "Darshan", "Deepak", "Dev", "Dhruv", "Gaurav", "Harsh", "Hiren", "Ishaan", "Jay", "Karan",
            "Kartik", "Kaushal", "Krishna", "Manav", "Mihir", "Nikhil", "Nilesh", "Nirav", "Parth", "Piyush",
            "Pranav", "Pratik", "Raj", "Rajan", "Ravi", "Rohan", "Rohit", "Sahil", "Sameer", "Sanjay",
            "Shreyas", "Siddharth", "Sumit", "Sunil", "Tarun", "Tejas", "Uday", "Varun", "Vatsal", "Vikram",
            "Vinay", "Yash", "Yogesh"
    };
    private static final String[] FIRST_NAMES_F = {
            "Aanya", "Aarti", "Akanksha", "Ananya", "Anjali", "Avani", "Bhavna", "Charvi", "Devika", "Diya",
            "Esha", "Gauri", "Heena", "Ishani", "Jagriti", "Jaya", "Kavya", "Khushi", "Krisha", "Lavanya",
            "Mahima", "Meera", "Mira", "Nandini", "Neha", "Nisha", "Pooja", "Pratiksha", "Priya", "Radhika",
            "Rashi", "Riya", "Sakshi", "Sanya", "Shreya", "Simran", "Sneha", "Swati", "Tanvi", "Tara",
            "Trisha", "Vidhi", "Vidya", "Yashasvi"
    };
    private static final String[] LAST_NAMES = {
            "Acharya", "Agarwal", "Bhatt", "Chauhan", "Choksi", "Dakwala", "Das", "Desai", "Dhanani",
            "Gandhi", "Ghosh", "Gupta", "Iyer", "Jain", "Joshi", "Kapadia", "Karkar", "Khan", "Kothari",
            "Krishnan", "Kulkarni", "Kumar", "Mehta", "Modi", "Nair", "Pandey", "Parekh", "Parikh", "Patel",
            "Patil", "Prajapati", "Rajput", "Rana", "Rao", "Reddy", "Sah", "Savaliya", "Sen", "Shah",
            "Sharma", "Shukla", "Singh", "Sinha", "Solanki", "Tiwari", "Trivedi", "Vyas", "Yadav"
    };
    private static final String[] CITIES = {
            "Ahmedabad", "Bengaluru", "Mumbai", "Pune", "Hyderabad", "Chennai", "Delhi", "Gurgaon", "Noida"
    };

    /** name → (band, designations, base monthly basic in INR) */
    private record Track(String dept, int band, String[] designations, int basicMin, int basicMax) {}

    private static final List<Track> TRACKS = List.of(
            new Track("Engineering", 1, new String[]{"Software Engineer Trainee"},                 25_000,  32_000),
            new Track("Engineering", 2, new String[]{"Associate Software Engineer"},               32_000,  42_000),
            new Track("Engineering", 3, new String[]{"Software Engineer"},                         42_000,  62_000),
            new Track("Engineering", 4, new String[]{"Senior Software Engineer"},                  62_000,  88_000),
            new Track("Engineering", 5, new String[]{"Tech Lead", "Staff Engineer"},               88_000, 130_000),
            new Track("Engineering", 6, new String[]{"Engineering Manager", "Principal Engineer"},130_000, 180_000),
            new Track("Engineering", 7, new String[]{"Director of Engineering"},                  180_000, 260_000),

            new Track("Quality Assurance", 2, new String[]{"QA Analyst"},                          30_000,  42_000),
            new Track("Quality Assurance", 3, new String[]{"QA Engineer"},                         42_000,  58_000),
            new Track("Quality Assurance", 4, new String[]{"Senior QA Engineer", "SDET"},          58_000,  82_000),
            new Track("Quality Assurance", 5, new String[]{"QA Lead"},                             82_000, 115_000),

            new Track("DevOps", 3, new String[]{"DevOps Engineer"},                                52_000,  72_000),
            new Track("DevOps", 4, new String[]{"Senior DevOps Engineer", "SRE"},                  72_000,  98_000),
            new Track("DevOps", 5, new String[]{"DevOps Lead"},                                    98_000, 140_000),

            new Track("Design", 2, new String[]{"Visual Designer"},                                35_000,  50_000),
            new Track("Design", 3, new String[]{"Product Designer"},                               55_000,  78_000),
            new Track("Design", 4, new String[]{"Senior Product Designer"},                        78_000, 110_000),
            new Track("Design", 5, new String[]{"Design Lead"},                                   110_000, 145_000),

            new Track("Product", 4, new String[]{"Product Manager"},                               90_000, 130_000),
            new Track("Product", 5, new String[]{"Senior Product Manager", "Group PM"},           130_000, 175_000),

            new Track("Data", 3, new String[]{"Data Analyst"},                                     50_000,  68_000),
            new Track("Data", 4, new String[]{"Data Engineer", "ML Engineer"},                     70_000,  98_000),
            new Track("Data", 5, new String[]{"Senior Data Engineer", "Senior ML Engineer"},       98_000, 140_000),

            new Track("Sales", 3, new String[]{"Account Executive"},                               40_000,  60_000),
            new Track("Sales", 4, new String[]{"Senior AE", "Sales Manager"},                      65_000,  95_000),
            new Track("Sales", 5, new String[]{"Sales Director"},                                 110_000, 160_000),

            new Track("Marketing", 3, new String[]{"Marketing Associate", "Content Writer"},       35_000,  55_000),
            new Track("Marketing", 4, new String[]{"Marketing Manager", "Growth Lead"},            65_000,  92_000),

            new Track("Finance", 3, new String[]{"Accountant"},                                    38_000,  55_000),
            new Track("Finance", 4, new String[]{"Senior Accountant", "Finance Manager"},          60_000,  92_000),

            new Track("People", 3, new String[]{"HR Generalist", "Recruiter"},                     38_000,  55_000),
            new Track("People", 4, new String[]{"HR Business Partner", "HR Manager"},              62_000,  90_000)
    );

    @Override
    @Transactional
    public void run(String... args) {
        long existing = employees.count();
        if (existing >= 50) {
            log.info("BulkEmployeeSeeder: skipping (employee count is {} — already seeded)", existing);
            return;
        }
        if (existing == 0) {
            log.warn("BulkEmployeeSeeder: skipping (no base employees yet)");
            return;
        }

        log.info("BulkEmployeeSeeder: seeding {} additional employees…", TARGET);

        // Ensure all departments exist
        Map<String, Department> deptByName = new HashMap<>();
        Set<String> deptNames = new LinkedHashSet<>();
        for (Track t : TRACKS) deptNames.add(t.dept);
        for (String name : deptNames) {
            Department d = departments.findByName(name).orElseGet(() ->
                    departments.save(Department.builder().name(name).build()));
            deptByName.put(name, d);
        }

        // Pre-bucket tracks by department, sorted by band ascending — used for hierarchy
        Map<String, List<Track>> tracksByDept = new HashMap<>();
        for (Track t : TRACKS) tracksByDept.computeIfAbsent(t.dept, k -> new ArrayList<>()).add(t);
        for (List<Track> ts : tracksByDept.values()) ts.sort(Comparator.comparingInt(Track::band));

        // Highest employee_code suffix so far
        int codeStart = (int) employees.count() + 1;
        long startId = System.currentTimeMillis();
        Random rnd = new Random(42); // deterministic for repeatable demos

        // Pre-allocate a list of managers per (dept, band) so subordinates can pick a parent.
        Map<String, Map<Integer, List<Employee>>> managersByDeptBand = new HashMap<>();
        for (String d : deptNames) managersByDeptBand.put(d, new HashMap<>());

        // Pre-seed with existing managers (Mira) so new hires can roll up under them
        employees.findAll().forEach(e -> {
            if (e.getDepartment() != null) {
                managersByDeptBand
                        .computeIfAbsent(e.getDepartment().getName(), k -> new HashMap<>())
                        .computeIfAbsent(4, k -> new ArrayList<>()) // assume band 4
                        .add(e);
            }
        });

        LocalDate today = LocalDate.now();
        int created = 0;

        for (int i = 0; i < TARGET; i++) {
            // Pick a track weighted toward Engineering (the bulk of an IT company).
            Track tr = pickTrack(rnd);

            boolean male = rnd.nextBoolean();
            String first = male
                    ? FIRST_NAMES_M[rnd.nextInt(FIRST_NAMES_M.length)]
                    : FIRST_NAMES_F[rnd.nextInt(FIRST_NAMES_F.length)];
            String last  = LAST_NAMES[rnd.nextInt(LAST_NAMES.length)];
            String designation = tr.designations[rnd.nextInt(tr.designations.length)];

            // Build a unique-ish email
            String slug = (first + "." + last).toLowerCase().replaceAll("[^a-z.]", "");
            String email = slug + (i + codeStart) + "@amnex.local";
            String code  = String.format("EMP-%05d", i + codeStart);

            Department dept = deptByName.get(tr.dept);
            LocalDate joined = today.minusDays(30 + rnd.nextInt(365 * 5));
            String phone = "+91-" + (700_000_0000L + (long) rnd.nextInt(99_999_999));
            String city = CITIES[rnd.nextInt(CITIES.length)];

            // Pick a manager: someone at a higher band in the same dept, if any exist
            Employee mgr = pickManager(managersByDeptBand.get(tr.dept), tr.band, rnd);

            Employee e = Employee.builder()
                    .employeeCode(code)
                    .firstName(first).lastName(last)
                    .email(email)
                    .phone(phone)
                    .address(city + ", India")
                    .designation(designation)
                    .department(dept)
                    .manager(mgr)
                    .joinedOn(joined)
                    .active(true)
                    .build();
            e = employees.save(e);

            // Register as potential manager for lower bands
            managersByDeptBand.get(tr.dept)
                    .computeIfAbsent(tr.band, k -> new ArrayList<>())
                    .add(e);

            // User account so they can log in: password = first name lowercased + "123"
            String pwd = first.toLowerCase() + "123";
            users.save(UserAccount.builder()
                    .email(email)
                    .passwordHash(encoder.encode(pwd))
                    .role(tr.band >= 6 ? Role.ADMIN : (tr.band >= 4 ? Role.MANAGER : Role.EMPLOYEE))
                    .employee(e)
                    .enabled(true)
                    .build());

            // Salary structure within the band's range
            int basic = tr.basicMin + rnd.nextInt(tr.basicMax - tr.basicMin + 1);
            int hra = (int) Math.round(basic * 0.4);
            int allowances = (int) Math.round(basic * 0.25);
            int deductions = (int) Math.round(basic * 0.12);
            salaryStructures.save(SalaryStructure.builder()
                    .employee(e)
                    .effectiveFrom(joined)
                    .basic(new BigDecimal(basic))
                    .hra(new BigDecimal(hra))
                    .allowances(new BigDecimal(allowances))
                    .deductions(new BigDecimal(deductions))
                    .build());

            // Allocate leave balances for the current year
            balances.allocateForYear(e, today.getYear());

            created++;
            if (created % 100 == 0) log.info("…{} employees seeded so far", created);
        }

        long elapsed = System.currentTimeMillis() - startId;
        log.info("BulkEmployeeSeeder: seeded {} employees in {} ms (total now {})",
                created, elapsed, employees.count());
    }

    private static Track pickTrack(Random rnd) {
        // Weight engineering tracks higher so the org skews IT-heavy
        int roll = rnd.nextInt(100);
        if (roll < 55) {
            // Engineering bands, distribution biased toward bands 2-4
            String dept = "Engineering";
            int band = pickEngBand(rnd);
            return TRACKS.stream().filter(t -> t.dept.equals(dept) && t.band == band).findFirst()
                    .orElse(TRACKS.get(2));
        }
        return TRACKS.get(rnd.nextInt(TRACKS.size()));
    }

    private static int pickEngBand(Random rnd) {
        int r = rnd.nextInt(100);
        if (r < 12) return 1;
        if (r < 30) return 2;
        if (r < 56) return 3;
        if (r < 78) return 4;
        if (r < 92) return 5;
        if (r < 99) return 6;
        return 7;
    }

    private static Employee pickManager(Map<Integer, List<Employee>> byBand, int band, Random rnd) {
        for (int target = band + 1; target <= 7; target++) {
            List<Employee> pool = byBand.get(target);
            if (pool != null && !pool.isEmpty()) {
                return pool.get(rnd.nextInt(pool.size()));
            }
        }
        return null; // no manager yet at higher bands
    }
}
