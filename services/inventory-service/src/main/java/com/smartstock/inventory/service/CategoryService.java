package com.smartstock.inventory.service;

import com.smartstock.inventory.dto.CatalogDtos.CategoryRequest;
import com.smartstock.inventory.dto.CatalogDtos.CategoryResponse;
import com.smartstock.inventory.entity.Category;
import com.smartstock.inventory.exception.ConflictException;
import com.smartstock.inventory.exception.ResourceNotFoundException;
import com.smartstock.inventory.repository.CategoryRepository;
import com.smartstock.inventory.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public List<CategoryResponse> list() {
        Map<Long, Long> counts = productRepository.countByCategory().stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1]));
        return categoryRepository.findAll(Sort.by("name")).stream()
                .map(c -> toResponse(c, counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    @Transactional
    public CategoryResponse create(CategoryRequest request) {
        if (categoryRepository.existsByNameIgnoreCase(request.name().trim())) {
            throw new ConflictException("Une catégorie porte déjà ce nom");
        }
        Category category = new Category();
        apply(category, request);
        return toResponse(categoryRepository.save(category), 0);
    }

    @Transactional
    public CategoryResponse update(Long id, CategoryRequest request) {
        Category category = find(id);
        if (categoryRepository.existsByNameIgnoreCaseAndIdNot(request.name().trim(), id)) {
            throw new ConflictException("Une catégorie porte déjà ce nom");
        }
        if (id.equals(request.parentId())) {
            throw new IllegalArgumentException("Une catégorie ne peut pas être son propre parent");
        }
        apply(category, request);
        long count = productRepository.countByCategory().stream()
                .filter(r -> id.equals(r[0])).mapToLong(r -> (Long) r[1]).sum();
        return toResponse(categoryRepository.save(category), count);
    }

    @Transactional
    public void delete(Long id) {
        Category category = find(id);
        if (productRepository.existsByCategoryId(id)) {
            throw new ConflictException("Catégorie utilisée par des produits — réaffectez-les d'abord");
        }
        if (categoryRepository.existsByParentId(id)) {
            throw new ConflictException("Catégorie parente d'autres catégories");
        }
        categoryRepository.delete(category);
    }

    Category find(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Catégorie introuvable: " + id));
    }

    private void apply(Category category, CategoryRequest request) {
        category.setName(request.name().trim());
        category.setDescription(request.description());
        category.setColor(request.color());
        category.setParent(request.parentId() == null ? null : find(request.parentId()));
    }

    private static CategoryResponse toResponse(Category c, long productCount) {
        Category parent = c.getParent();
        return new CategoryResponse(c.getId(), c.getName(), c.getDescription(), c.getColor(),
                parent == null ? null : parent.getId(), parent == null ? null : parent.getName(),
                productCount, c.getCreatedAt());
    }
}
