<!-- column tabs shown on narrow screens only -->
<nav class="board-column-nav" aria-label="<?= t('Columns') ?>">
    <?php foreach ($columns as $column): ?>
        <a href="#" class="board-column-nav-item" data-column-id="<?= $column['id'] ?>" title="<?= $this->text->e($column['title']) ?>">
            <span class="board-column-nav-title"><?= $this->text->e($column['title']) ?></span>
            <span class="board-column-nav-count" title="<?= t('Task count') ?>"><?= $column['nb_visible_tasks'] ?></span>
        </a>
    <?php endforeach ?>
</nav>
