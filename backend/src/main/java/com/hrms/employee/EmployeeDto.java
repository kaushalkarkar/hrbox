package com.hrms.employee;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public class EmployeeDto {

    public record EmployeeView(
            Long id,
            String employeeCode,
            String firstName,
            String lastName,
            String email,
            String phone,
            String address,
            String designation,
            Long departmentId,
            String departmentName,
            Long managerId,
            String managerName,
            LocalDate joinedOn,
            String photoFilename
    ) {}

    public record CreateRequest(
            @NotBlank String firstName,
            @NotBlank String lastName,
            @Email @NotBlank String email,
            String phone,
            String address,
            String designation,
            Long departmentId,
            Long managerId,
            @NotNull LocalDate joinedOn,
            @NotBlank String initialPassword,
            @NotBlank String role
    ) {}

    public record OrgNode(
            Long id,
            String employeeCode,
            String firstName,
            String lastName,
            String designation,
            String departmentName,
            String photoFilename
    ) {}

    public record OrgChart(
            List<OrgNode> chain,   // root ??? ... ??? manager ??? current employee
            List<OrgNode> reports  // direct reports of the current employee
    ) {}

    public record UpdateRequest(
            @NotBlank String firstName,
            @NotBlank String lastName,
            @Email @NotBlank String email,
            String phone,
            String address,
            String designation,
            Long departmentId,
            Long managerId,
            @NotNull LocalDate joinedOn
    ) {}
}
