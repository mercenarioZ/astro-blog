---
title: "Spring Boot #1: Annotations"
tags:
  - notes
  - spring
  - java
heroImage: notes-spring-boot-annotations/hero.png
createdAt: 2026-06-30
layout: ../../layouts/BlogPost.astro
---

Spring gives us a lot of annotations, and the hard part is not memorizing every one of them. It is knowing where each annotation belongs in the shape of a normal app.

These are the ones we keep meeting when an HTTP request moves through a Spring Boot project: controller, service, repository, configuration, validation, and transaction boundaries.

## Application entry point

`@SpringBootApplication` is the main annotation on the application class.

It combines three ideas:

- `@Configuration`: this class can define Spring beans.
- `@EnableAutoConfiguration`: Spring Boot should configure the usual app infrastructure automatically.
- `@ComponentScan`: Spring should scan the current package and child packages for components.

```java
@SpringBootApplication
public class ApiApplication {
  public static void main(String[] args) {
    SpringApplication.run(ApiApplication.class, args);
  }
}
```

The practical rule: put this class near the root package so Spring can discover controllers, services, repositories, and configuration classes below it.

## Web layer

`@RestController` marks a class as a REST controller. We can think of it as `@Controller` plus `@ResponseBody`, so returned values are written to the HTTP response body.

```java
@RestController
@RequestMapping("/api/users")
public class UserController {
  private final UserService userService;

  public UserController(UserService userService) {
    this.userService = userService;
  }

  @GetMapping("/{id}")
  public UserResponse findById(@PathVariable Long id) {
    return userService.findById(id);
  }
}
```

Request annotations we use the most:

- `@RequestMapping`: base route or generic request mapping.
- `@GetMapping`: handle GET requests.
- `@PostMapping`: handle POST requests.
- `@PutMapping`: handle PUT requests.
- `@PatchMapping`: handle PATCH requests.
- `@DeleteMapping`: handle DELETE requests.
- `@PathVariable`: read a value from the URL path.
- `@RequestParam`: read a query string value.
- `@RequestBody`: deserialize JSON request body into an object.

Example:

```java
@PostMapping
public UserResponse create(@RequestBody CreateUserRequest request) {
  return userService.create(request);
}
```

## Service and business logic

`@Service` marks a class as a business logic component.

```java
@Service
public class UserService {
  private final UserRepository userRepository;

  public UserService(UserRepository userRepository) {
    this.userRepository = userRepository;
  }
}
```

This is usually where application rules live. We keep controllers thin, then let repositories focus on persistence.

## Persistence layer

`@Repository` marks a persistence component. For Spring Data JPA interfaces, extending `JpaRepository` is usually enough, but `@Repository` still shows up in custom persistence classes.

```java
public interface UserRepository extends JpaRepository<User, Long> {
  Optional<User> findByEmail(String email);
}
```

JPA entity annotations:

- `@Entity`: maps a class to a database table.
- `@Id`: marks the primary key.
- `@GeneratedValue`: defines how the primary key is generated.
- `@Column`: customizes a column.
- `@Table`: customizes the table.

```java
@Entity
@Table(name = "users")
public class User {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true)
  private String email;
}
```

## Dependency injection

The annotations `@Component`, `@Service`, `@Repository`, and `@Controller` all make classes Spring-managed beans.

`@Autowired` injects dependencies, but constructor injection is usually cleaner because dependencies become explicit and easier to test.

Preferred:

```java
@Service
public class OrderService {
  private final PaymentClient paymentClient;

  public OrderService(PaymentClient paymentClient) {
    this.paymentClient = paymentClient;
  }
}
```

Less preferred:

```java
@Autowired
private PaymentClient paymentClient;
```

Constructor injection also works nicely with `final` fields.

## Configuration

`@Configuration` marks a class that defines beans manually.

`@Bean` marks a method whose return value should be managed by Spring.

```java
@Configuration
public class AppConfig {
  @Bean
  public Clock clock() {
    return Clock.systemUTC();
  }
}
```

We use this when the class comes from a library, needs custom construction, or cannot be annotated directly with `@Component`.

## Properties

`@Value` injects a single property.

```java
@Value("${app.upload-dir}")
private String uploadDir;
```

`@ConfigurationProperties` is better for grouped configuration.

```java
@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(
  String bucket,
  String region
) {}
```

For bigger applications, grouped configuration is easier to test and refactor than many scattered `@Value` fields.

## Validation

Validation annotations usually come from Jakarta Bean Validation.

The annotations we reach for first:

- `@Valid`: trigger validation on a request object.
- `@NotNull`: value cannot be null.
- `@NotBlank`: string cannot be null or blank.
- `@Size`: string or collection length constraints.
- `@Email`: value should be email-shaped.

```java
public record CreateUserRequest(
  @NotBlank String name,
  @Email String email
) {}

@PostMapping
public UserResponse create(@Valid @RequestBody CreateUserRequest request) {
  return userService.create(request);
}
```

## Transactions

`@Transactional` wraps a method in a database transaction.

```java
@Transactional
public void transfer(Long fromId, Long toId, BigDecimal amount) {
  withdraw(fromId, amount);
  deposit(toId, amount);
}
```

If something fails, the transaction can roll back instead of leaving the database half-updated.

We should be careful with transaction boundaries. A transaction usually belongs at the service layer, not inside controllers.

## How the pieces line up

The usual Spring Boot shape is:

```text
HTTP request
  -> @RestController
  -> @Service
  -> @Repository
  -> Database
```

Annotations mostly tell Spring:

- What classes should be managed.
- How HTTP requests map to Java methods.
- How data moves between JSON, Java objects, and the database.
- Where configuration and transactions should apply.

## Quick rule of thumb

- Use `@RestController` for HTTP endpoints.
- Use `@Service` for business logic.
- Use `@Repository` or Spring Data repositories for persistence.
- Use constructor injection by default.
- Use `@Configuration` and `@Bean` for manually-created dependencies.
- Use `@Valid` and validation annotations at API boundaries.
- Use `@Transactional` around business operations that must commit or roll back together.
