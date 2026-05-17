package com.hrms.employee;

import com.hrms.domain.Department;
import com.hrms.domain.Employee;
import com.hrms.domain.Role;
import com.hrms.domain.UserAccount;
import com.hrms.leave.LeaveBalanceService;
import com.hrms.repo.DepartmentRepository;
import com.hrms.repo.EmployeeRepository;
import com.hrms.repo.UserAccountRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Year;
import java.util.List;

import static org.springframework.http.HttpStatus.*;

@Service
@Transactional
public class EmployeeService {

    private final EmployeeRepository employees;
    private final DepartmentRepository departments;
    private final UserAccountRepository users;
    private final PasswordEncoder encoder;
    private final LeaveBalanceService balances;

    public EmployeeService(EmployeeRepository employees,
                           DepartmentRepository departments,
                           UserAccountRepository users,
                           PasswordEncoder encoder,
                           LeaveBalanceService balances) {
        this.employees = employees;
        this.departments = departments;
        this.users = users;
        this.encoder = encoder;
        this.balances = balances;
    }

    @Transactional(readOnly = true)
    public List<EmployeeDto.EmployeeView> search(Long departmentId, String q) {
        String query = (q == null || q.isBlank()) ? "" : q.trim();
        return employees.search(departmentId, query).stream().map(this::toView).toList();
    }

    @Transactional(readOnly = true)
    public EmployeeDto.EmployeeView get(Long id) {
        return toView(load(id));
    }

    @Transactional(readOnly = true)
    public EmployeeDto.OrgChart orgChart(Long id) {
        Employee me = load(id);

        // Walk up the manager chain (cap at 5 levels to avoid pathological loops)
        java.util.LinkedList<EmployeeDto.OrgNode> chain = new java.util.LinkedList<>();
        Employee cur = me;
        int safety = 0;
        while (cur != null && safety++ < 6) {
            chain.addFirst(toOrgNode(cur));
            cur = cur.getManager();
        }

        List<EmployeeDto.OrgNode> reports = employees.findByManagerId(id).stream()
                .map(this::toOrgNode)
                .toList();
        return new EmployeeDto.OrgChart(chain, reports);
    }

    private EmployeeDto.OrgNode toOrgNode(Employee e) {
        return new EmployeeDto.OrgNode(
                e.getId(), e.getEmployeeCode(),
                e.getFirstName(), e.getLastName(),
                e.getDesignation(),
                e.getDepartment() == null ? null : e.getDepartment().getName(),
                e.getPhotoFilename()
        );
    }

    public EmployeeDto.EmployeeView create(EmployeeDto.CreateRequest req) {
        if (employees.existsByEmail(req.email()) || users.existsByEmail(req.email())) {
            throw new ResponseStatusException(CONFLICT, "Email already in use");
        }
        Role role;
        try {
            role = Role.valueOf(req.role());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid role");
        }

        Department dept = req.departmentId() == null ? null
                : departments.findById(req.departmentId())
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Unknown department"));

        Employee manager = req.managerId() == null ? null
                : employees.findById(req.managerId())
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Unknown manager"));

        Employee e = Employee.builder()
                .employeeCode(nextEmployeeCode())
                .firstName(req.firstName())
                .lastName(req.lastName())
                .email(req.email())
                .phone(req.phone())
                .address(req.address())
                .designation(req.designation())
                .department(dept)
                .manager(manager)
                .joinedOn(req.joinedOn())
                .build();
        e = employees.save(e);

        UserAccount user = UserAccount.builder()
                .email(req.email())
                .passwordHash(encoder.encode(req.initialPassword()))
                .role(role)
                .employee(e)
                .enabled(true)
                .build();
        users.save(user);

        balances.allocateForYear(e, Year.now().getValue());

        return toView(e);
    }

    public EmployeeDto.EmployeeView update(Long id, EmployeeDto.UpdateRequest req) {
        Employee e = load(id);

        if (!e.getEmail().equalsIgnoreCase(req.email())
                && (employees.existsByEmail(req.email()) || users.existsByEmail(req.email()))) {
            throw new ResponseStatusException(CONFLICT, "Email already in use");
        }

        Department dept = req.departmentId() == null ? null
                : departments.findById(req.departmentId())
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Unknown department"));

        Employee manager = req.managerId() == null ? null
                : employees.findById(req.managerId())
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Unknown manager"));
        if (manager != null && manager.getId().equals(e.getId())) {
            throw new ResponseStatusException(BAD_REQUEST, "Employee cannot be their own manager");
        }

        String oldEmail = e.getEmail();
        e.setFirstName(req.firstName());
        e.setLastName(req.lastName());
        e.setEmail(req.email());
        e.setPhone(req.phone());
        e.setAddress(req.address());
        e.setDesignation(req.designation());
        e.setDepartment(dept);
        e.setManager(manager);
        e.setJoinedOn(req.joinedOn());

        if (!oldEmail.equalsIgnoreCase(req.email())) {
            users.findByEmail(oldEmail).ifPresent(u -> u.setEmail(req.email()));
        }
        return toView(e);
    }

    public void adminResetPassword(Long employeeId, String newPassword) {
        Employee e = load(employeeId);
        UserAccount user = users.findByEmail(e.getEmail())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "User account not found for employee"));
        user.setPasswordHash(encoder.encode(newPassword));
    }

    public void delete(Long id) {
        Employee e = load(id);
        users.findByEmail(e.getEmail()).ifPresent(users::delete);
        if (!employees.findByManagerId(id).isEmpty()) {
            throw new ResponseStatusException(CONFLICT, "Cannot delete: this employee is set as a manager");
        }
        employees.delete(e);
    }

    private Employee load(Long id) {
        return employees.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
    }

    private String nextEmployeeCode() {
        // EMP-00001 style, simple monotonic on count. Fine for this scope.
        long count = employees.count() + 1;
        return String.format("EMP-%05d", count);
    }

    EmployeeDto.EmployeeView toView(Employee e) {
        return new EmployeeDto.EmployeeView(
                e.getId(),
                e.getEmployeeCode(),
                e.getFirstName(),
                e.getLastName(),
                e.getEmail(),
                e.getPhone(),
                e.getAddress(),
                e.getDesignation(),
                e.getDepartment() == null ? null : e.getDepartment().getId(),
                e.getDepartment() == null ? null : e.getDepartment().getName(),
                e.getManager() == null ? null : e.getManager().getId(),
                e.getManager() == null ? null : (e.getManager().getFirstName() + " " + e.getManager().getLastName()),
                e.getJoinedOn(),
                e.getPhotoFilename()
        );
    }
}
